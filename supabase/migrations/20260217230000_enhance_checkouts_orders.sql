-- ============================================================
-- Migration: Enhance Checkouts & Orders
--
-- Adds missing fields discussed in v1 planning:
-- - orders.order_number: sequential per tenant (human-readable)
-- - checkouts.expires_at: for time-limited offers
-- - checkouts.success_url: custom redirect after checkout
-- - checkouts.cover_url: override product cover on checkout
-- ============================================================

-- ============================================================
-- 1. ADD COLUMNS
-- ============================================================

-- orders: sequential number per tenant for human-readable reference
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS order_number INTEGER;

-- checkouts: expiration and redirect
ALTER TABLE public.checkouts
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS success_url TEXT,
  ADD COLUMN IF NOT EXISTS cover_url TEXT;

-- ============================================================
-- 2. ORDER NUMBER SEQUENCE (per-tenant)
-- ============================================================

-- Function to auto-assign order_number on insert
CREATE OR REPLACE FUNCTION public.set_order_number()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.order_number IS NULL THEN
    SELECT COALESCE(MAX(order_number), 0) + 1
      INTO NEW.order_number
      FROM public.orders
      WHERE tenant_id = NEW.tenant_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_set_order_number
  BEFORE INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.set_order_number();

-- Index for fast order_number lookup per tenant
CREATE INDEX IF NOT EXISTS idx_orders_number
  ON public.orders(tenant_id, order_number DESC);

-- ============================================================
-- 3. UPDATE public checkout RPC to include expires_at check
-- ============================================================

-- Drop first because return type changed (PG doesn't allow ALTER on return type)
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
  amount_cents integer,
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
    pr.amount_cents,
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

-- ============================================================
-- 4. INCREMENT CHECKOUT ORDERS RPC
-- ============================================================

-- Used by the process-checkout edge function to atomically increment total_orders
CREATE OR REPLACE FUNCTION public.increment_checkout_orders(p_checkout_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = 'public'
AS $$
  UPDATE public.checkouts
  SET total_orders = total_orders + 1
  WHERE id = p_checkout_id;
$$;
