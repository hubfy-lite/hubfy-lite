-- RPC to duplicate a course with all its modules, lessons, lesson_videos, and lesson_assets_link.
-- Returns JSON with new course info and a media_map for client-side storage copy.

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
  v_new_smart_id  text;
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
  -- 1. Fetch source course and validate tenant ownership
  SELECT id, title, slug, description, category, is_active,
         cover_horizontal_url, cover_vertical_url
    INTO v_source
    FROM courses
   WHERE id = p_source_course_id
     AND tenant_id = p_tenant_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Course not found or does not belong to this tenant';
  END IF;

  -- 2. Generate unique slug
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

  -- 3. Insert new course (trigger will generate smart_id and create a default module)
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
  RETURNING id, smart_id INTO v_new_course_id, v_new_smart_id;

  -- 4. Delete the auto-created default module (from handle_new_course trigger)
  DELETE FROM modules WHERE course_id = v_new_course_id;

  -- 5. Clone modules, lessons, lesson_videos, lesson_assets_link
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
      SELECT id, title, description, content, thumbnail_url, video_url,
             video_provider, duration_seconds, sort_order, is_active
        FROM lessons
       WHERE module_id = v_mod.id
       ORDER BY sort_order
    LOOP
      INSERT INTO lessons (module_id, title, description, content, thumbnail_url,
                           video_url, video_provider, duration_seconds, sort_order, is_active)
      VALUES (v_new_module_id, v_les.title, v_les.description, v_les.content,
              v_les.thumbnail_url, v_les.video_url, v_les.video_provider,
              v_les.duration_seconds, v_les.sort_order, v_les.is_active)
      RETURNING id INTO v_new_lesson_id;

      -- Clone lesson_videos
      INSERT INTO lesson_videos (lesson_id, provider, gumlet_asset_id, gumlet_collection_id,
                                 playback_url, thumbnail_url, status, duration_seconds,
                                 is_public, provider_payload)
      SELECT v_new_lesson_id, provider, gumlet_asset_id, gumlet_collection_id,
             playback_url, thumbnail_url, status, duration_seconds,
             is_public, provider_payload
        FROM lesson_videos
       WHERE lesson_id = v_les.id;

      -- Clone lesson_assets_link
      INSERT INTO lesson_assets_link (lesson_id, asset_id, sort_order, label)
      SELECT v_new_lesson_id, asset_id, sort_order, label
        FROM lesson_assets_link
       WHERE lesson_id = v_les.id;

      -- Build media map entry for this lesson
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

  -- 6. Return result with media map
  RETURN json_build_object(
    'course_id', v_new_course_id,
    'smart_id', v_new_smart_id,
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
