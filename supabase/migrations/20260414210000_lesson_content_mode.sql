-- Lesson content editing mode: persist whether content was authored in the
-- visual editor (TipTap) or as raw HTML. This lets the admin UI reopen the
-- lesson in the same mode the author last used, so HTML the editor can't
-- round-trip (iframes, advanced markup) is not silently normalized.
--
-- Touches:
--   1. lessons.content_mode column ('rich' | 'html', default 'rich')
--   2. save_lesson_editor RPC — add p_content_mode param, persist it
--   3. duplicate_course RPC — carry content_mode over to the copy

-- ═══════════════════════════════════════════════════════════════════════
-- 1. Add content_mode column
-- ═══════════════════════════════════════════════════════════════════════

ALTER TABLE public.lessons
  ADD COLUMN IF NOT EXISTS content_mode TEXT NOT NULL DEFAULT 'rich'
  CHECK (content_mode IN ('rich', 'html'));

-- ═══════════════════════════════════════════════════════════════════════
-- 2. Recreate save_lesson_editor with p_content_mode
--    (copied from 20260331180000_lesson_links_display_url.sql, with 2 diffs
--    marked NEW)
-- ═══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.save_lesson_editor(
  p_lesson_id UUID,
  p_title TEXT,
  p_description TEXT DEFAULT NULL,
  p_thumbnail_path TEXT DEFAULT NULL,
  p_content_html TEXT DEFAULT NULL,
  p_content_mode TEXT DEFAULT 'rich',
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
  v_content_mode TEXT;
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

  -- NEW: normalize content_mode (defensive — the CHECK constraint would
  -- reject other values, but we prefer a clean default over a raised error)
  v_content_mode := COALESCE(p_content_mode, 'rich');
  IF v_content_mode NOT IN ('rich', 'html') THEN
    v_content_mode := 'rich';
  END IF;

  -- 4. Update lesson fields (clear legacy columns)
  UPDATE public.lessons
  SET
    title = TRIM(p_title),
    description = p_description,
    thumbnail_url = p_thumbnail_path,
    content = p_content_html,
    content_mode = v_content_mode,
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

-- ═══════════════════════════════════════════════════════════════════════
-- 3. Recreate duplicate_course carrying content_mode over to the copy
--    (copied from 20260331170000_lesson_links_via_blocks.sql, adding
--    content_mode to the lessons SELECT/INSERT)
-- ═══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.duplicate_course(
  p_source_course_id uuid,
  p_tenant_id uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_source        RECORD;
  v_new_course_id uuid;
  v_new_public_id text;
  v_base_slug     text;
  v_slug          text;
  v_counter       int := 1;
  v_slug_exists   boolean;
  v_mod           RECORD;
  v_new_module_id uuid;
  v_les           RECORD;
  v_new_lesson_id uuid;
  v_media_lessons json := '[]'::json;
BEGIN
  SELECT id, title, slug, description, category, is_active,
         cover_horizontal_url, cover_vertical_url
    INTO v_source
    FROM courses
   WHERE id = p_source_course_id
     AND tenant_id = p_tenant_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Course not found or does not belong to this tenant';
  END IF;

  v_base_slug := v_source.slug || '-copia';
  v_slug := v_base_slug;

  LOOP
    SELECT EXISTS(
      SELECT 1 FROM courses WHERE tenant_id = p_tenant_id AND slug = v_slug
    ) INTO v_slug_exists;

    EXIT WHEN NOT v_slug_exists;

    v_counter := v_counter + 1;
    v_slug := v_base_slug || '-' || v_counter;
  END LOOP;

  INSERT INTO courses (tenant_id, title, slug, description, category, is_active,
                       cover_horizontal_url, cover_vertical_url)
  VALUES (p_tenant_id,
          v_source.title || ' (Cópia)',
          v_slug,
          v_source.description,
          v_source.category,
          v_source.is_active,
          v_source.cover_horizontal_url,
          v_source.cover_vertical_url)
  RETURNING id, public_id INTO v_new_course_id, v_new_public_id;

  DELETE FROM modules WHERE course_id = v_new_course_id;

  FOR v_mod IN
    SELECT id, title, description, sort_order, is_default
      FROM modules
     WHERE course_id = p_source_course_id
     ORDER BY sort_order
  LOOP
    INSERT INTO modules (course_id, title, description, sort_order, is_default)
    VALUES (v_new_course_id, v_mod.title, v_mod.description, v_mod.sort_order, v_mod.is_default)
    RETURNING id INTO v_new_module_id;

    FOR v_les IN
      SELECT id, title, description, content, content_mode, thumbnail_url, video_url,
             video_provider, duration_seconds, sort_order, is_active
        FROM lessons
       WHERE module_id = v_mod.id
       ORDER BY sort_order
    LOOP
      INSERT INTO lessons (module_id, title, description, content, content_mode, thumbnail_url,
                           video_url, video_provider, duration_seconds, sort_order, is_active)
      VALUES (v_new_module_id, v_les.title, v_les.description, v_les.content, v_les.content_mode,
              v_les.thumbnail_url, v_les.video_url, v_les.video_provider,
              v_les.duration_seconds, v_les.sort_order, v_les.is_active)
      RETURNING id INTO v_new_lesson_id;

      -- Clone lesson_videos (provider_asset_id — renamed from gumlet_asset_id in 20260320200000)
      INSERT INTO lesson_videos (lesson_id, provider, provider_asset_id, gumlet_collection_id,
                                 playback_url, thumbnail_url, status, duration_seconds,
                                 is_public, provider_payload)
      SELECT v_new_lesson_id, provider, provider_asset_id, gumlet_collection_id,
             playback_url, thumbnail_url, status, duration_seconds,
             is_public, provider_payload
        FROM lesson_videos
       WHERE lesson_id = v_les.id;

      -- Clone lesson_assets_link
      INSERT INTO lesson_assets_link (lesson_id, asset_id, sort_order, label)
      SELECT v_new_lesson_id, asset_id, sort_order, label
        FROM lesson_assets_link
       WHERE lesson_id = v_les.id;

      -- Clone lesson_blocks (links and any future block types)
      INSERT INTO lesson_blocks (lesson_id, type, payload, sort_order)
      SELECT v_new_lesson_id, type, payload, sort_order
        FROM lesson_blocks
       WHERE lesson_id = v_les.id;

      IF v_les.thumbnail_url IS NOT NULL THEN
        v_media_lessons := (
          SELECT json_agg(elem)
            FROM (
              SELECT elem FROM json_array_elements(v_media_lessons) AS elem
              UNION ALL
              SELECT json_build_object(
                'old_lesson_id', v_les.id,
                'new_lesson_id', v_new_lesson_id,
                'thumbnail_url', v_les.thumbnail_url
              )
            ) sub
        );
      END IF;
    END LOOP;
  END LOOP;

  RETURN json_build_object(
    'course_id', v_new_course_id,
    'public_id', v_new_public_id,
    'slug', v_slug,
    'title', v_source.title || ' (Cópia)',
    'media_map', json_build_object(
      'course_cover_horizontal', v_source.cover_horizontal_url,
      'course_cover_vertical', v_source.cover_vertical_url,
      'lessons', COALESCE(v_media_lessons, '[]'::json)
    )
  );
END;
$$;
