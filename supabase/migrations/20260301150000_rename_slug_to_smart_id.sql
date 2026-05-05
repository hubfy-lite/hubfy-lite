-- ============================================================
-- Migration: Rename slug → smart_id
--
-- checkouts.slug      → checkouts.smart_id
-- courses.slug_id     → courses.smart_id
--
-- Renames columns, constraints, functions, and triggers.
-- ============================================================

-- ============================================================
-- 1. CHECKOUTS: RENAME COLUMN + CONSTRAINT
-- ============================================================

ALTER TABLE public.checkouts RENAME COLUMN slug TO smart_id;

ALTER TABLE public.checkouts
  RENAME CONSTRAINT checkouts_slug_key TO checkouts_smart_id_key;

-- ============================================================
-- 2. COURSES: RENAME COLUMN + CONSTRAINT
-- ============================================================

ALTER TABLE public.courses RENAME COLUMN slug_id TO smart_id;

ALTER TABLE public.courses
  RENAME CONSTRAINT courses_slug_id_key TO courses_smart_id_key;

-- ============================================================
-- 3. CHECKOUT FUNCTIONS — DROP OLD + CREATE NEW
-- ============================================================

-- Drop old triggers first (they reference old functions)
DROP TRIGGER IF EXISTS trg_set_checkout_slug ON public.checkouts;
DROP TRIGGER IF EXISTS trg_prevent_checkout_slug_update ON public.checkouts;

-- Drop old functions
DROP FUNCTION IF EXISTS public.generate_checkout_slug();
DROP FUNCTION IF EXISTS public.set_checkout_slug();
DROP FUNCTION IF EXISTS public.prevent_checkout_slug_update();

-- 3a. Generate smart_id for checkouts
CREATE OR REPLACE FUNCTION public.generate_checkout_smart_id()
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
      RAISE EXCEPTION 'Failed to generate unique checkout smart_id after 100 attempts';
    END IF;

    v_bytes := extensions.gen_random_bytes(7);
    v_slug := '';

    FOR i IN 0..6 LOOP
      v_slug := v_slug || substr(v_alphabet, (get_byte(v_bytes, i) % v_alphabet_len) + 1, 1);
    END LOOP;

    SELECT EXISTS(SELECT 1 FROM public.checkouts WHERE smart_id = v_slug) INTO v_exists;
    IF NOT v_exists THEN
      RETURN v_slug;
    END IF;
  END LOOP;
END;
$$;

-- 3b. Auto-assign smart_id on insert
CREATE OR REPLACE FUNCTION public.set_checkout_smart_id()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.smart_id := public.generate_checkout_smart_id();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_set_checkout_smart_id
  BEFORE INSERT ON public.checkouts
  FOR EACH ROW EXECUTE FUNCTION public.set_checkout_smart_id();

-- 3c. Prevent smart_id updates
CREATE OR REPLACE FUNCTION public.prevent_checkout_smart_id_update()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.smart_id IS DISTINCT FROM OLD.smart_id THEN
    NEW.smart_id := OLD.smart_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_prevent_checkout_smart_id_update
  BEFORE UPDATE ON public.checkouts
  FOR EACH ROW EXECUTE FUNCTION public.prevent_checkout_smart_id_update();

-- ============================================================
-- 4. COURSE FUNCTIONS — DROP OLD + CREATE NEW
-- ============================================================

-- Drop old triggers first
DROP TRIGGER IF EXISTS trg_set_course_slug_id ON public.courses;
DROP TRIGGER IF EXISTS trg_prevent_course_slug_id_update ON public.courses;

-- Drop old functions
DROP FUNCTION IF EXISTS public.generate_course_slug_id();
DROP FUNCTION IF EXISTS public.set_course_slug_id();
DROP FUNCTION IF EXISTS public.prevent_course_slug_id_update();

-- 4a. Generate smart_id for courses
CREATE OR REPLACE FUNCTION public.generate_course_smart_id()
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
      RAISE EXCEPTION 'Failed to generate unique course smart_id after 100 attempts';
    END IF;

    v_bytes := extensions.gen_random_bytes(7);
    v_slug := '';

    FOR i IN 0..6 LOOP
      v_slug := v_slug || substr(v_alphabet, (get_byte(v_bytes, i) % v_alphabet_len) + 1, 1);
    END LOOP;

    SELECT EXISTS(SELECT 1 FROM public.courses WHERE smart_id = v_slug) INTO v_exists;
    IF NOT v_exists THEN
      RETURN v_slug;
    END IF;
  END LOOP;
END;
$$;

-- 4b. Auto-assign smart_id on insert
CREATE OR REPLACE FUNCTION public.set_course_smart_id()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.smart_id := public.generate_course_smart_id();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_set_course_smart_id
  BEFORE INSERT ON public.courses
  FOR EACH ROW EXECUTE FUNCTION public.set_course_smart_id();

-- 4c. Prevent smart_id updates
CREATE OR REPLACE FUNCTION public.prevent_course_smart_id_update()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.smart_id IS DISTINCT FROM OLD.smart_id THEN
    NEW.smart_id := OLD.smart_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_prevent_course_smart_id_update
  BEFORE UPDATE ON public.courses
  FOR EACH ROW EXECUTE FUNCTION public.prevent_course_smart_id_update();

-- ============================================================
-- 5. UPDATE get_public_checkout RPC
-- ============================================================

-- Drop existing function
DROP FUNCTION IF EXISTS public.get_public_checkout(text);

CREATE OR REPLACE FUNCTION public.get_public_checkout(p_checkout_smart_id text)
RETURNS TABLE (
  id uuid,
  smart_id text,
  title text,
  description text,
  product_id uuid,
  product_title text,
  product_description text,
  product_cover_url text,
  price_cents bigint,
  original_price_cents bigint,
  currency text,
  cta_text text,
  accent_color text,
  show_testimonials boolean,
  show_guarantee boolean,
  guarantee_days integer,
  custom_css text,
  tenant_id uuid,
  tenant_name text,
  tenant_slug text,
  tenant_logo_url text,
  payment_methods text[],
  max_installments integer,
  facebook_pixel_id text,
  google_analytics_id text,
  custom_header_scripts text,
  show_banner boolean,
  banner_image_url text,
  banner_bg_color text,
  bump_product_id uuid,
  bump_title text,
  bump_description text,
  bump_price_cents bigint,
  bump_product_title text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    c.smart_id,
    c.title,
    c.description,
    c.product_id,
    p.title          AS product_title,
    p.description     AS product_description,
    p.cover_url       AS product_cover_url,
    c.price_cents,
    c.original_price_cents,
    c.currency,
    c.cta_text,
    c.accent_color,
    c.show_testimonials,
    c.show_guarantee,
    c.guarantee_days,
    c.custom_css,
    c.tenant_id,
    t.name            AS tenant_name,
    t.slug            AS tenant_slug,
    t.logo_url        AS tenant_logo_url,
    c.payment_methods,
    c.max_installments,
    c.facebook_pixel_id,
    c.google_analytics_id,
    c.custom_header_scripts,
    c.show_banner,
    c.banner_image_url,
    c.banner_bg_color,
    c.bump_product_id,
    c.bump_title,
    c.bump_description,
    c.bump_price_cents,
    bp.title          AS bump_product_title
  FROM checkouts c
  JOIN products p  ON p.id = c.product_id
  JOIN tenants  t  ON t.id = c.tenant_id
  LEFT JOIN products bp ON bp.id = c.bump_product_id
  WHERE c.smart_id = p_checkout_smart_id
    AND c.is_active = true;
END;
$$;
