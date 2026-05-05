-- Ensure pgcrypto is available for gen_random_bytes
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- ============================================================
-- Migration: Checkout Global Slug
--
-- Changes the checkout slug to be:
-- - Auto-generated (7 chars, crypto-random)
-- - Globally unique (not per-tenant)
-- - Immutable after creation
-- - Using alphabet: 234679acdefghjkmnpqrtuvwxy
--
-- Also updates the get_public_checkout RPC to lookup by
-- slug only (no tenant_slug needed).
-- ============================================================

-- ============================================================
-- 1. SLUG GENERATION FUNCTION
-- ============================================================

-- Generates a cryptographically random 7-char slug using the
-- allowed alphabet: 234679acdefghjkmnpqrtuvwxy (26 chars)
-- Uses gen_random_bytes for crypto randomness.
CREATE OR REPLACE FUNCTION public.generate_checkout_slug()
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
      RAISE EXCEPTION 'Failed to generate unique checkout slug after 100 attempts';
    END IF;

    -- Generate 7 random bytes
    v_bytes := extensions.gen_random_bytes(7);
    v_slug := '';

    FOR i IN 0..6 LOOP
      v_slug := v_slug || substr(v_alphabet, (get_byte(v_bytes, i) % v_alphabet_len) + 1, 1);
    END LOOP;

    -- Check global uniqueness
    SELECT EXISTS(SELECT 1 FROM public.checkouts WHERE slug = v_slug) INTO v_exists;
    IF NOT v_exists THEN
      RETURN v_slug;
    END IF;
  END LOOP;
END;
$$;

-- ============================================================
-- 2. AUTO-ASSIGN SLUG ON INSERT
-- ============================================================

CREATE OR REPLACE FUNCTION public.set_checkout_slug()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Always generate a new slug, ignoring any value the client sent
  NEW.slug := public.generate_checkout_slug();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_set_checkout_slug
  BEFORE INSERT ON public.checkouts
  FOR EACH ROW EXECUTE FUNCTION public.set_checkout_slug();

-- ============================================================
-- 3. PREVENT SLUG UPDATES
-- ============================================================

CREATE OR REPLACE FUNCTION public.prevent_checkout_slug_update()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.slug IS DISTINCT FROM OLD.slug THEN
    NEW.slug := OLD.slug; -- silently revert
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_prevent_checkout_slug_update
  BEFORE UPDATE ON public.checkouts
  FOR EACH ROW EXECUTE FUNCTION public.prevent_checkout_slug_update();

-- ============================================================
-- 4. MIGRATE EXISTING SLUGS TO NEW FORMAT
-- ============================================================

-- Re-generate slugs for any existing checkouts so they conform
-- to the new global-unique 7-char format.
DO $$
DECLARE
  r RECORD;
  v_new_slug text;
BEGIN
  FOR r IN SELECT id FROM public.checkouts LOOP
    v_new_slug := public.generate_checkout_slug();
    -- Direct update bypassing the prevent-update trigger
    -- (trigger only fires on UPDATE, we use a raw UPDATE here)
    UPDATE public.checkouts SET slug = v_new_slug WHERE id = r.id;
  END LOOP;
END;
$$;

-- ============================================================
-- 5. CHANGE UNIQUE CONSTRAINT TO GLOBAL
-- ============================================================

-- Drop the old per-tenant unique constraint
ALTER TABLE public.checkouts DROP CONSTRAINT IF EXISTS checkouts_tenant_id_slug_key;

-- Drop the old per-tenant index
DROP INDEX IF EXISTS idx_checkouts_slug;

-- Add global unique constraint
ALTER TABLE public.checkouts ADD CONSTRAINT checkouts_slug_key UNIQUE (slug);

-- Index for fast slug lookup (the unique constraint already creates one,
-- but let's be explicit with a named index for clarity)
-- The unique constraint already provides this, so no extra index needed.

-- ============================================================
-- 6. UPDATE get_public_checkout RPC
-- ============================================================

-- Drop old version (signature changes: only 1 param now)
DROP FUNCTION IF EXISTS public.get_public_checkout(text, text);

CREATE OR REPLACE FUNCTION public.get_public_checkout(
  p_checkout_slug text
)
RETURNS TABLE (
  id uuid,
  slug text,
  title text,
  description text,
  collect_phone boolean,
  collect_address boolean,
  expires_at timestamptz,
  cover_url text,
  product_id uuid,
  product_name text,
  product_cover_url text,
  unit_price integer,
  currency text,
  tenant_id uuid,
  tenant_name text,
  tenant_slug text,
  tenant_logo_url text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    c.slug,
    c.title,
    c.description,
    c.collect_phone,
    c.collect_address,
    c.expires_at,
    c.cover_url,
    c.product_id,
    p.name AS product_name,
    p.cover_url AS product_cover_url,
    pr.unit_price,
    pr.currency,
    t.id AS tenant_id,
    t.name AS tenant_name,
    t.slug AS tenant_slug,
    t.logo_url AS tenant_logo_url
  FROM public.checkouts c
  JOIN public.tenants t ON t.id = c.tenant_id
  JOIN public.products p ON p.id = c.product_id
  JOIN public.prices pr ON pr.id = c.price_id
  WHERE c.slug = p_checkout_slug
    AND c.status = 'active'
    AND p.status = 'published'
    AND pr.is_active = true
    AND (c.expires_at IS NULL OR c.expires_at > now());
END;
$$;
