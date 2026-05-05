-- ============================================================
-- Migration: Course Slug ID (short global identifier)
--
-- Adds a slug_id column to courses, following the same pattern
-- as checkouts: 7-char crypto-random, globally unique, immutable.
-- This allows public course URLs like /courses/{slug_id}
-- ============================================================

-- Ensure pgcrypto is available for gen_random_bytes
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- ============================================================
-- 1. SLUG ID GENERATION FUNCTION
-- ============================================================

CREATE OR REPLACE FUNCTION public.generate_course_slug_id()
RETURNS text
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
  v_alphabet text := '234679acdefghjkmnpqrtuvwxy';
  v_alphabet_len int := 26;
  v_slug text;
  v_bytes bytea;
  v_exists boolean;
  v_attempts int := 0;
BEGIN
  LOOP
    v_attempts := v_attempts + 1;
    IF v_attempts > 100 THEN
      RAISE EXCEPTION 'Failed to generate unique course slug_id after 100 attempts';
    END IF;

    -- Generate 7 random bytes
    v_bytes := extensions.gen_random_bytes(7);
    v_slug := '';

    FOR i IN 0..6 LOOP
      v_slug := v_slug || substr(v_alphabet, (get_byte(v_bytes, i) % v_alphabet_len) + 1, 1);
    END LOOP;

    -- Check global uniqueness (across all tenants)
    SELECT EXISTS(SELECT 1 FROM public.courses WHERE slug_id = v_slug) INTO v_exists;
    IF NOT v_exists THEN
      RETURN v_slug;
    END IF;
  END LOOP;
END;
$$;

-- ============================================================
-- 2. ADD slug_id COLUMN
-- ============================================================

ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS slug_id text;

-- ============================================================
-- 3. POPULATE EXISTING ROWS
-- ============================================================

DO $$
DECLARE
  r RECORD;
  v_new_slug text;
BEGIN
  FOR r IN SELECT id FROM public.courses WHERE slug_id IS NULL LOOP
    v_new_slug := public.generate_course_slug_id();
    UPDATE public.courses SET slug_id = v_new_slug WHERE id = r.id;
  END LOOP;
END;
$$;

-- ============================================================
-- 4. MAKE slug_id NOT NULL + GLOBALLY UNIQUE
-- ============================================================

ALTER TABLE public.courses
  ALTER COLUMN slug_id SET NOT NULL;

ALTER TABLE public.courses
  ADD CONSTRAINT courses_slug_id_key UNIQUE (slug_id);

-- ============================================================
-- 5. AUTO-ASSIGN slug_id ON INSERT
-- ============================================================

CREATE OR REPLACE FUNCTION public.set_course_slug_id()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Always generate a new slug_id, ignoring any value the client sent
  NEW.slug_id := public.generate_course_slug_id();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_set_course_slug_id
  BEFORE INSERT ON public.courses
  FOR EACH ROW EXECUTE FUNCTION public.set_course_slug_id();

-- ============================================================
-- 6. PREVENT slug_id UPDATES
-- ============================================================

CREATE OR REPLACE FUNCTION public.prevent_course_slug_id_update()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.slug_id IS DISTINCT FROM OLD.slug_id THEN
    NEW.slug_id := OLD.slug_id; -- silently revert
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_prevent_course_slug_id_update
  BEFORE UPDATE ON public.courses
  FOR EACH ROW EXECUTE FUNCTION public.prevent_course_slug_id_update();
