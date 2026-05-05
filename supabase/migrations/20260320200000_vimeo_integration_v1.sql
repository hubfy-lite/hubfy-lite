-- Vimeo V1 Integration: tenant_integrations + lesson_videos as canonical video source
-- This migration:
--   1. Creates tenant_integrations + tenant_integration_secrets
--   2. Generalizes lesson_videos (rename gumlet_asset_id → provider_asset_id, expand provider)
--   3. Backfills existing YouTube lessons into lesson_videos
--   4. Recreates save_lesson_editor and duplicate_course RPCs

-- ═══════════════════════════════════════════════════════════════════════
-- 1. TENANT INTEGRATIONS
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.tenant_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  account_name TEXT,
  account_external_id TEXT,
  account_url TEXT,
  avatar_url TEXT,
  last_validated_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, provider)
);

CREATE TRIGGER set_tenant_integrations_updated_at
  BEFORE UPDATE ON public.tenant_integrations
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.tenant_integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "editors and admins can read integrations"
  ON public.tenant_integrations FOR SELECT
  USING (is_tenant_editor(tenant_id) OR is_admin());

CREATE POLICY "editors and admins can manage integrations"
  ON public.tenant_integrations FOR ALL
  USING (is_tenant_editor(tenant_id) OR is_admin())
  WITH CHECK (is_tenant_editor(tenant_id) OR is_admin());

-- Secrets: service role only (RLS enabled, zero policies)
CREATE TABLE IF NOT EXISTS public.tenant_integration_secrets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id UUID NOT NULL UNIQUE REFERENCES public.tenant_integrations(id) ON DELETE CASCADE,
  access_token TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.tenant_integration_secrets ENABLE ROW LEVEL SECURITY;

-- ═══════════════════════════════════════════════════════════════════════
-- 2. GENERALIZE lesson_videos
-- ═══════════════════════════════════════════════════════════════════════

-- 2a. Rename gumlet_asset_id → provider_asset_id
ALTER TABLE public.lesson_videos RENAME COLUMN gumlet_asset_id TO provider_asset_id;

-- 2b. Make nullable (Vimeo/YouTube don't go through internal assets)
ALTER TABLE public.lesson_videos ALTER COLUMN provider_asset_id DROP NOT NULL;

-- 2c. Expand provider CHECK constraint
ALTER TABLE public.lesson_videos DROP CONSTRAINT IF EXISTS lesson_videos_provider_check;
ALTER TABLE public.lesson_videos ADD CONSTRAINT lesson_videos_provider_check
  CHECK (provider IN ('gumlet', 'youtube', 'vimeo'));

-- 2d. Recreate index with new column name (NOT unique — multiple lessons can share the same video)
DROP INDEX IF EXISTS idx_lesson_videos_gumlet_asset_id;
CREATE INDEX idx_lesson_videos_provider_asset_id
  ON public.lesson_videos(provider_asset_id) WHERE provider_asset_id IS NOT NULL;

-- ═══════════════════════════════════════════════════════════════════════
-- 3. BACKFILL YouTube → lesson_videos
-- ═══════════════════════════════════════════════════════════════════════

-- Regex matches the same formats as the app's youtube-utils.ts YT_REGEX:
--   youtube.com/watch?v=, youtube.com/embed/, youtube.com/v/, youtu.be/
INSERT INTO public.lesson_videos (
  lesson_id, provider, provider_asset_id, playback_url, status, provider_payload
)
SELECT
  l.id,
  l.video_provider,
  (regexp_match(l.video_url, '(?:youtube\.com/(?:watch\?.*v=|embed/|v/)|youtu\.be/)([\w-]{11})'))[1],
  'https://www.youtube.com/embed/' ||
    (regexp_match(l.video_url, '(?:youtube\.com/(?:watch\?.*v=|embed/|v/)|youtu\.be/)([\w-]{11})'))[1],
  'ready',
  jsonb_build_object('source_url', l.video_url)
FROM public.lessons l
WHERE l.video_provider IS NOT NULL
  AND l.video_url IS NOT NULL
  AND l.id NOT IN (SELECT lesson_id FROM public.lesson_videos)
  AND (regexp_match(l.video_url, '(?:youtube\.com/(?:watch\?.*v=|embed/|v/)|youtu\.be/)([\w-]{11})'))[1] IS NOT NULL;

-- ═══════════════════════════════════════════════════════════════════════
-- 4. RECREATE save_lesson_editor RPC
-- ═══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.save_lesson_editor(
  p_lesson_id UUID,
  p_title TEXT,
  p_description TEXT DEFAULT NULL,
  p_thumbnail_path TEXT DEFAULT NULL,
  p_content_html TEXT DEFAULT NULL,
  -- Gumlet: via internal asset library (resolves to lesson_videos internally)
  p_video_asset_id UUID DEFAULT NULL,
  -- Generic provider: Vimeo, YouTube (writes directly to lesson_videos)
  p_video_provider TEXT DEFAULT NULL,
  p_video_provider_asset_id TEXT DEFAULT NULL,
  p_video_playback_url TEXT DEFAULT NULL,
  p_video_thumbnail_url TEXT DEFAULT NULL,
  p_video_duration INTEGER DEFAULT NULL,
  p_video_payload JSONB DEFAULT NULL,
  -- File links
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
  v_current_provider_asset_id TEXT;
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

  -- 5a. Gumlet path: resolve asset → lesson_videos
  IF p_video_asset_id IS NOT NULL THEN
    -- Get current provider_asset_id for comparison
    SELECT lv.provider_asset_id INTO v_current_provider_asset_id
    FROM public.lesson_videos lv
    WHERE lv.lesson_id = p_lesson_id AND lv.provider = 'gumlet'
    LIMIT 1;

    -- Look up the asset's gumlet data (asset_videos keeps gumlet_asset_id — Gumlet infra)
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

    -- Only re-insert if asset changed
    IF v_video_data.gumlet_asset_id IS DISTINCT FROM v_current_provider_asset_id THEN
      DELETE FROM public.lesson_videos WHERE lesson_id = p_lesson_id;

      INSERT INTO public.lesson_videos (
        lesson_id, provider, provider_asset_id, playback_url, thumbnail_url, duration_seconds, status
      ) VALUES (
        p_lesson_id,
        'gumlet',
        v_video_data.gumlet_asset_id,
        v_video_data.playback_url,
        v_video_data.thumbnail_url,
        v_video_data.duration_seconds,
        'ready'
      );
    END IF;

  -- 5b. External provider path: Vimeo, YouTube — write directly
  ELSIF p_video_provider IS NOT NULL AND p_video_provider != '' THEN
    DELETE FROM public.lesson_videos WHERE lesson_id = p_lesson_id;

    INSERT INTO public.lesson_videos (
      lesson_id, provider, provider_asset_id, playback_url, thumbnail_url,
      duration_seconds, status, provider_payload
    ) VALUES (
      p_lesson_id,
      p_video_provider,
      p_video_provider_asset_id,
      p_video_playback_url,
      p_video_thumbnail_url,
      p_video_duration,
      'ready',
      COALESCE(p_video_payload, '{}'::jsonb)
    );

  -- 5c. No video selected → clear
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

  RETURN jsonb_build_object('success', true);
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════
-- 5. RECREATE duplicate_course RPC (with provider_asset_id)
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

  -- 3. Insert new course
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

  -- 4. Delete the auto-created default module
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

      -- Clone lesson_videos (with provider_asset_id)
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

      -- Build media map entry
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
