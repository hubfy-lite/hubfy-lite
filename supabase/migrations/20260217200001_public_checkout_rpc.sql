-- ============================================================
-- Migration: Public Checkout RPC
--
-- Creates a SECURITY DEFINER function to fetch checkout data
-- for the public checkout page (no auth required).
-- ============================================================

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
  product_id uuid,
  product_name text,
  amount_cents integer,
  currency text,
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
    c.product_id,
    p.name AS product_name,
    pr.amount_cents,
    pr.currency,
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
    AND pr.is_active = true;
END;
$$;
