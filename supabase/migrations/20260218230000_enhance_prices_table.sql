-- ============================================================
-- Migration: Enhance Prices Table
--
-- Aligns prices table with full Price Object spec:
-- - Replace price_type enum with price_category
-- - Rename amount_cents → unit_price
-- - Add pricing scheme, usage aggregation, tiers
-- - Add subscription fields (renewal, trial)
-- - Add setup fees, PWYW fields
-- - Update RPCs that reference old column names
-- ============================================================

-- ============================================================
-- 1. NEW ENUMS
-- ============================================================

DO $$ BEGIN
  CREATE TYPE public.price_category AS ENUM ('one_time', 'subscription', 'lead_magnet', 'pwyw');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.price_scheme AS ENUM ('standard', 'package', 'graduated', 'volume');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.usage_aggregation_type AS ENUM ('sum', 'last_during_period', 'last_ever', 'max');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.interval_unit AS ENUM ('day', 'week', 'month', 'year');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- 2. ALTER PRICES TABLE
-- ============================================================

-- 2a. Rename amount_cents → unit_price
ALTER TABLE public.prices RENAME COLUMN amount_cents TO unit_price;

-- 2b. Add category column (replaces type)
ALTER TABLE public.prices
  ADD COLUMN IF NOT EXISTS category public.price_category NOT NULL DEFAULT 'one_time';

-- Migrate existing type data to category
UPDATE public.prices
SET category = CASE
  WHEN type = 'recurring' THEN 'subscription'::public.price_category
  ELSE 'one_time'::public.price_category
END;

-- 2c. Drop old type column and enum
ALTER TABLE public.prices DROP COLUMN IF EXISTS type;
DROP TYPE IF EXISTS public.price_type;

-- 2d. Add all new columns
ALTER TABLE public.prices
  ADD COLUMN IF NOT EXISTS scheme public.price_scheme NOT NULL DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS usage_aggregation public.usage_aggregation_type,
  ADD COLUMN IF NOT EXISTS unit_price_decimal TEXT,
  ADD COLUMN IF NOT EXISTS setup_fee_enabled BOOLEAN,
  ADD COLUMN IF NOT EXISTS setup_fee INTEGER,
  ADD COLUMN IF NOT EXISTS package_size INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS tiers JSONB,
  ADD COLUMN IF NOT EXISTS renewal_interval_unit public.interval_unit,
  ADD COLUMN IF NOT EXISTS renewal_interval_quantity INTEGER,
  ADD COLUMN IF NOT EXISTS trial_interval_unit public.interval_unit,
  ADD COLUMN IF NOT EXISTS trial_interval_quantity INTEGER,
  ADD COLUMN IF NOT EXISTS min_price INTEGER,
  ADD COLUMN IF NOT EXISTS suggested_price INTEGER;

-- ============================================================
-- 3. COMMENTS
-- ============================================================

COMMENT ON COLUMN public.prices.category IS 'Price category: one_time, subscription, lead_magnet, pwyw';
COMMENT ON COLUMN public.prices.scheme IS 'Pricing model: standard, package, graduated, volume';
COMMENT ON COLUMN public.prices.usage_aggregation IS 'Usage aggregation type for usage-based billing (null if not usage-based)';
COMMENT ON COLUMN public.prices.unit_price IS 'Price in cents (positive integer). Not used for volume/graduated pricing.';
COMMENT ON COLUMN public.prices.unit_price_decimal IS 'Price as decimal string in cents. Used when usage_aggregation is enabled.';
COMMENT ON COLUMN public.prices.setup_fee_enabled IS 'Whether subscription has a setup fee (null for non-subscription)';
COMMENT ON COLUMN public.prices.setup_fee IS 'Setup fee in cents (null for non-subscription)';
COMMENT ON COLUMN public.prices.package_size IS 'Units per package (1 for standard/graduated/volume)';
COMMENT ON COLUMN public.prices.tiers IS 'Pricing tier data for volume/graduated schemes (JSONB array)';
COMMENT ON COLUMN public.prices.renewal_interval_unit IS 'Subscription billing interval unit (null for non-subscription)';
COMMENT ON COLUMN public.prices.renewal_interval_quantity IS 'Number of intervals between billings (null for non-subscription)';
COMMENT ON COLUMN public.prices.trial_interval_unit IS 'Free trial interval unit (null if no trial)';
COMMENT ON COLUMN public.prices.trial_interval_quantity IS 'Free trial interval count (null if no trial)';
COMMENT ON COLUMN public.prices.min_price IS 'Minimum price in cents for PWYW (null for other categories)';
COMMENT ON COLUMN public.prices.suggested_price IS 'Suggested price in cents for PWYW (null for other categories)';

-- ============================================================
-- 4. UPDATE RPCs (amount_cents → unit_price)
-- ============================================================

-- Drop and recreate get_public_checkout with renamed column
DROP FUNCTION IF EXISTS public.get_public_checkout(text, text);

CREATE OR REPLACE FUNCTION public.get_public_checkout(
  p_tenant_slug text,
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
  WHERE t.slug = p_tenant_slug
    AND c.slug = p_checkout_slug
    AND c.status = 'active'
    AND p.status = 'published'
    AND pr.is_active = true
    AND (c.expires_at IS NULL OR c.expires_at > now());
END;
$$;
