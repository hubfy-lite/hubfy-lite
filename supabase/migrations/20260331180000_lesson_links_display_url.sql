-- Add display_url support to lesson link blocks.
-- Updates save_lesson_editor RPC to persist display_url in link payload.
-- Backwards-compatible: existing links without display_url continue to work.

CREATE OR REPLACE FUNCTION public.save_lesson_editor(
  p_lesson_id UUID,
  p_title TEXT,
  p_description TEXT DEFAULT NULL,
  p_thumbnail_path TEXT DEFAULT NULL,
  p_content_html TEXT DEFAULT NULL,
  p_video_asset_id UUID DEFAULT NULL,
  p_video_provider TEXT DEFAULT NULL,
  p_video_provider_asset_id TEXT DEFAULT NULL,
  p_video_playback_url TEXT DEFAULT NULL,
  p_video_thumbnail_url TEXT DEFAULT NULL,
  p_video_duration INTEGER DEFAULT NULL,
  p_video_payload JSONB DEFAULT NULL,
  p_linked_asset_ids UUID[] DEFAULT '{}',
  p_links JSONB DEFAULT '[]'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_course_id UUID;
  v_tenant_id UUID;
  v_current_provider_asset_id TEXT;
  v_video_data RECORD;
  v_asset_id UUID;
  v_sort_order INTEGER;
  v_asset_title TEXT;
  v_link JSONB;
  v_url TEXT;
BEGIN
  -- 1. Validate lesson exists and get course/tenant
  SELECT get_lesson_course(p_lesson_id) INTO v_course_id;
  IF v_course_id IS NULL THEN
    RAISE EXCEPTION 'Lesson not found: %', p_lesson_id;
  END IF;

  SELECT get_course_tenant(v_course_id) INTO v_tenant_id;
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Course tenant not found';
  END IF;

  -- 2. Validate caller is editor of this tenant
  IF NOT is_tenant_editor(v_tenant_id) AND NOT is_admin() THEN
    RAISE EXCEPTION 'Permission denied: not an editor of this tenant';
  END IF;

  -- 3. Validate title
  IF TRIM(p_title) = '' THEN
    RAISE EXCEPTION 'Title cannot be empty';
  END IF;

  -- 4. Update lesson fields (clear legacy columns)
  UPDATE public.lessons
  SET
    title = TRIM(p_title),
    description = p_description,
    thumbnail_url = p_thumbnail_path,
    content = p_content_html,
    video_url = NULL,
    video_provider = NULL
  WHERE id = p_lesson_id;

  -- 5. Handle video — everything goes to lesson_videos

  -- 5a. Gumlet path
  IF p_video_asset_id IS NOT NULL THEN
    SELECT lv.provider_asset_id INTO v_current_provider_asset_id
    FROM public.lesson_videos lv
    WHERE lv.lesson_id = p_lesson_id AND lv.provider = 'gumlet'
    LIMIT 1;

    SELECT av.gumlet_asset_id, av.playback_url, av.thumbnail_url, av.duration_seconds
    INTO v_video_data
    FROM public.asset_videos av
    WHERE av.asset_id = p_video_asset_id;

    IF v_video_data IS NULL THEN
      RAISE EXCEPTION 'Video asset not found: %', p_video_asset_id;
    END IF;

    IF NOT asset_lesson_same_tenant(p_video_asset_id, p_lesson_id) THEN
      RAISE EXCEPTION 'Video asset does not belong to the same tenant as the lesson';
    END IF;

    IF v_video_data.gumlet_asset_id IS DISTINCT FROM v_current_provider_asset_id THEN
      DELETE FROM public.lesson_videos WHERE lesson_id = p_lesson_id;

      INSERT INTO public.lesson_videos (
        lesson_id, provider, provider_asset_id, playback_url, thumbnail_url, duration_seconds, status
      ) VALUES (
        p_lesson_id, 'gumlet', v_video_data.gumlet_asset_id,
        v_video_data.playback_url, v_video_data.thumbnail_url,
        v_video_data.duration_seconds, 'ready'
      );
    END IF;

  -- 5b. External provider
  ELSIF p_video_provider IS NOT NULL AND p_video_provider != '' THEN
    DELETE FROM public.lesson_videos WHERE lesson_id = p_lesson_id;

    INSERT INTO public.lesson_videos (
      lesson_id, provider, provider_asset_id, playback_url, thumbnail_url,
      duration_seconds, status, provider_payload
    ) VALUES (
      p_lesson_id, p_video_provider, p_video_provider_asset_id,
      p_video_playback_url, p_video_thumbnail_url, p_video_duration,
      'ready', COALESCE(p_video_payload, '{}'::jsonb)
    );

  -- 5c. No video
  ELSE
    DELETE FROM public.lesson_videos WHERE lesson_id = p_lesson_id;
  END IF;

  -- 6. Handle file links
  DELETE FROM public.lesson_assets_link
  WHERE lesson_id = p_lesson_id
    AND asset_id != ALL(p_linked_asset_ids);

  v_sort_order := 0;
  FOREACH v_asset_id IN ARRAY p_linked_asset_ids LOOP
    IF NOT asset_lesson_same_tenant(v_asset_id, p_lesson_id) THEN
      RAISE EXCEPTION 'File asset % does not belong to the same tenant as the lesson', v_asset_id;
    END IF;

    SELECT title INTO v_asset_title FROM public.assets WHERE id = v_asset_id;

    INSERT INTO public.lesson_assets_link (lesson_id, asset_id, sort_order, label)
    VALUES (p_lesson_id, v_asset_id, v_sort_order, v_asset_title)
    ON CONFLICT (lesson_id, asset_id)
    DO UPDATE SET sort_order = EXCLUDED.sort_order, label = EXCLUDED.label;

    v_sort_order := v_sort_order + 1;
  END LOOP;

  -- 7. Handle external links (lesson_blocks type='link')
  DELETE FROM public.lesson_blocks
  WHERE lesson_id = p_lesson_id AND type = 'link';

  v_sort_order := 0;
  FOR v_link IN SELECT * FROM jsonb_array_elements(COALESCE(p_links, '[]'::jsonb))
  LOOP
    v_url := TRIM(COALESCE(v_link->>'url', ''));
    CONTINUE WHEN v_url = '';

    IF v_url !~ '^https?://' THEN
      v_url := 'https://' || v_url;
    END IF;

    INSERT INTO public.lesson_blocks (lesson_id, type, payload, sort_order)
    VALUES (
      p_lesson_id,
      'link',
      jsonb_build_object(
        'label',       COALESCE(TRIM(v_link->>'label'), ''),
        'url',         v_url,
        'display_url', COALESCE(TRIM(v_link->>'display_url'), '')
      ),
      v_sort_order
    );
    v_sort_order := v_sort_order + 1;
  END LOOP;

  RETURN jsonb_build_object('success', true);
END;
$$;
