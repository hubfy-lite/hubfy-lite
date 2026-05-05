-- ============================================================
-- Migration: Standardize on unit_amount + currency constraint
--
-- Renames:
--   prices.unit_price         → unit_amount
--   prices.unit_price_decimal → unit_amount_decimal
--   orders.amount_cents       → unit_amount
--
-- Adds CHECK constraint on currency columns (only 'USD','BRL').
--
-- Updates all RPCs that reference old column names.
-- ============================================================

-- ============================================================
-- 1. RENAME COLUMNS
-- ============================================================

-- prices: unit_price → unit_amount
ALTER TABLE public.prices RENAME COLUMN unit_price TO unit_amount;

-- prices: unit_price_decimal → unit_amount_decimal
ALTER TABLE public.prices RENAME COLUMN unit_price_decimal TO unit_amount_decimal;

-- orders: amount_cents → unit_amount
ALTER TABLE public.orders RENAME COLUMN amount_cents TO unit_amount;

-- ============================================================
-- 2. CURRENCY CHECK CONSTRAINTS
-- ============================================================

ALTER TABLE public.prices
  ADD CONSTRAINT chk_prices_currency
  CHECK (currency IN ('USD', 'BRL'));

ALTER TABLE public.orders
  ADD CONSTRAINT chk_orders_currency
  CHECK (currency IN ('USD', 'BRL'));

-- ============================================================
-- 3. UPDATE COMMENTS
-- ============================================================

COMMENT ON COLUMN public.prices.unit_amount IS 'Price in minor currency units (cents). Stripe-aligned naming.';
COMMENT ON COLUMN public.prices.unit_amount_decimal IS 'Price as decimal string in minor units. Used when usage_aggregation is enabled.';
COMMENT ON COLUMN public.orders.unit_amount IS 'Order amount in minor currency units (cents). Stripe-aligned naming.';

-- ============================================================
-- 4. UPDATE get_public_checkout RPC
-- ============================================================

-- Drop old version (the slug-global migration created a 1-param version)
DROP FUNCTION IF EXISTS public.get_public_checkout(text);

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
  unit_amount integer,
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
    pr.unit_amount,
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
