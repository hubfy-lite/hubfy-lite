-- RPC: save_lesson_editor
-- Transactional save for the lesson editor. Replaces the hybrid model
-- where video/files saved immediately and general/blocks saved via footer.
--
-- All changes are applied atomically: lesson fields, video, and file links.

CREATE OR REPLACE FUNCTION public.save_lesson_editor(
  p_lesson_id UUID,
  p_title TEXT,
  p_thumbnail_path TEXT DEFAULT NULL,
  p_content_html TEXT DEFAULT NULL,
  p_video_asset_id UUID DEFAULT NULL,
  p_linked_asset_ids UUID[] DEFAULT '{}'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_course_id UUID;
  v_tenant_id UUID;
  v_current_video_asset_id UUID;
  v_video_data RECORD;
  v_asset_id UUID;
  v_sort_order INTEGER;
  v_asset_title TEXT;
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

  -- 3. Validate title is not empty
  IF TRIM(p_title) = '' THEN
    RAISE EXCEPTION 'Title cannot be empty';
  END IF;

  -- 4. Update lesson fields (without description)
  UPDATE public.lessons
  SET
    title = TRIM(p_title),
    thumbnail_url = p_thumbnail_path,
    content = p_content_html
  WHERE id = p_lesson_id;

  -- 5. Handle video: compare with current
  -- Find current video's asset_id by joining lesson_videos → asset_videos
  SELECT av.asset_id INTO v_current_video_asset_id
  FROM public.lesson_videos lv
  JOIN public.asset_videos av ON av.gumlet_asset_id = lv.gumlet_asset_id
  WHERE lv.lesson_id = p_lesson_id
  LIMIT 1;

  -- Only change if different
  IF p_video_asset_id IS DISTINCT FROM v_current_video_asset_id THEN
    -- Remove existing video if any
    DELETE FROM public.lesson_videos WHERE lesson_id = p_lesson_id;

    -- Insert new video if requested
    IF p_video_asset_id IS NOT NULL THEN
      -- Fetch video data from asset_videos
      SELECT av.gumlet_asset_id, av.playback_url, av.thumbnail_url, av.duration_seconds
      INTO v_video_data
      FROM public.asset_videos av
      WHERE av.asset_id = p_video_asset_id;

      IF v_video_data IS NULL THEN
        RAISE EXCEPTION 'Video asset not found: %', p_video_asset_id;
      END IF;

      -- Validate asset belongs to same tenant
      IF NOT asset_lesson_same_tenant(p_video_asset_id, p_lesson_id) THEN
        RAISE EXCEPTION 'Video asset does not belong to the same tenant as the lesson';
      END IF;

      INSERT INTO public.lesson_videos (
        lesson_id, gumlet_asset_id, playback_url, thumbnail_url, duration_seconds, status
      ) VALUES (
        p_lesson_id,
        v_video_data.gumlet_asset_id,
        v_video_data.playback_url,
        v_video_data.thumbnail_url,
        v_video_data.duration_seconds,
        'ready'
      );
    END IF;
  END IF;

  -- 6. Handle file links: diff current vs desired
  -- Delete links that are no longer in the list
  DELETE FROM public.lesson_assets_link
  WHERE lesson_id = p_lesson_id
    AND asset_id != ALL(p_linked_asset_ids);

  -- Upsert links in order (position in array = sort_order)
  v_sort_order := 0;
  FOREACH v_asset_id IN ARRAY p_linked_asset_ids LOOP
    -- Validate asset belongs to same tenant
    IF NOT asset_lesson_same_tenant(v_asset_id, p_lesson_id) THEN
      RAISE EXCEPTION 'File asset % does not belong to the same tenant as the lesson', v_asset_id;
    END IF;

    -- Get asset title for label
    SELECT title INTO v_asset_title FROM public.assets WHERE id = v_asset_id;

    INSERT INTO public.lesson_assets_link (lesson_id, asset_id, sort_order, label)
    VALUES (p_lesson_id, v_asset_id, v_sort_order, v_asset_title)
    ON CONFLICT (lesson_id, asset_id)
    DO UPDATE SET sort_order = EXCLUDED.sort_order, label = EXCLUDED.label;

    v_sort_order := v_sort_order + 1;
  END LOOP;

  RETURN jsonb_build_object('success', true);
END;
$$;
