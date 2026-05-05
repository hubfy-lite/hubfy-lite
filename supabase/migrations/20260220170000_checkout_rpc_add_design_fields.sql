-- ============================================================
-- Update get_public_checkout RPC:
-- - Add checkout design fields from tenants table so global
--   design settings actually apply to public checkout pages
-- ============================================================

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
  collect_fiscal_id boolean,
  allow_discount_codes boolean,
  expires_at timestamptz,
  cover_url text,
  confirmation_message text,
  success_url text,
  product_id uuid,
  product_name text,
  product_cover_url text,
  product_status text,
  unit_amount integer,
  currency text,
  price_category text,
  renewal_interval_unit text,
  renewal_interval_quantity integer,
  tenant_id uuid,
  tenant_name text,
  tenant_slug text,
  tenant_logo_url text,
  tenant_icon_url text,
  tenant_primary_color text,
  checkout_use_brand_colors boolean,
  checkout_bg_color text,
  checkout_button_color text,
  checkout_button_style text,
  checkout_font_family text
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
    c.collect_fiscal_id,
    c.allow_discount_codes,
    c.expires_at,
    c.cover_url,
    c.confirmation_message,
    c.success_url,
    c.product_id,
    p.name AS product_name,
    p.cover_url AS product_cover_url,
    p.status::text AS product_status,
    pr.unit_amount,
    pr.currency,
    pr.category::text AS price_category,
    pr.renewal_interval_unit::text AS renewal_interval_unit,
    pr.renewal_interval_quantity,
    t.id AS tenant_id,
    t.name AS tenant_name,
    t.slug AS tenant_slug,
    t.logo_url AS tenant_logo_url,
    t.icon_url AS tenant_icon_url,
    t.primary_color AS tenant_primary_color,
    t.checkout_use_brand_colors,
    t.checkout_bg_color,
    t.checkout_button_color,
    t.checkout_button_style,
    t.checkout_font_family
  FROM public.checkouts c
  JOIN public.tenants t ON t.id = c.tenant_id
  JOIN public.products p ON p.id = c.product_id
  JOIN public.prices pr ON pr.id = c.price_id
  WHERE c.slug = p_checkout_slug
    AND c.status = 'active'
    AND pr.is_active = true
    AND (c.expires_at IS NULL OR c.expires_at > now());
END;
$$;
