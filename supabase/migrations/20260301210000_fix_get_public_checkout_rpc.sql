-- ============================================================
-- Fix: get_public_checkout RPC had wrong column references
--
-- The rename_slug_to_smart_id migration recreated the function
-- with a stale definition. This restores the correct columns
-- matching the actual checkouts table schema.
-- ============================================================

DROP FUNCTION IF EXISTS public.get_public_checkout(text);

CREATE OR REPLACE FUNCTION public.get_public_checkout(
  p_checkout_smart_id text
)
RETURNS TABLE (
  id uuid,
  smart_id text,
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
  -- product fields (no product_id)
  product_name text,
  product_cover_url text,
  product_status text,
  -- price fields
  unit_amount integer,
  currency text,
  price_category text,
  renewal_interval_unit text,
  renewal_interval_quantity integer,
  -- tenant fields (no tenant_id)
  tenant_name text,
  tenant_slug text,
  tenant_logo_url text,
  tenant_icon_url text,
  tenant_primary_color text,
  tenant_theme_mode text,
  -- design fields
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
    c.smart_id,
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
    p.name AS product_name,
    p.cover_url AS product_cover_url,
    p.status::text AS product_status,
    pr.unit_amount,
    pr.currency,
    pr.category::text AS price_category,
    pr.renewal_interval_unit::text AS renewal_interval_unit,
    pr.renewal_interval_quantity,
    t.name AS tenant_name,
    t.slug AS tenant_slug,
    t.logo_url AS tenant_logo_url,
    t.icon_url AS tenant_icon_url,
    t.primary_color AS tenant_primary_color,
    t.theme_mode::text AS tenant_theme_mode,
    t.checkout_use_brand_colors,
    t.checkout_bg_color,
    t.checkout_button_color,
    t.checkout_button_style,
    t.checkout_font_family
  FROM public.checkouts c
  JOIN public.tenants t ON t.id = c.tenant_id
  JOIN public.products p ON p.id = c.product_id
  JOIN public.prices pr ON pr.id = c.price_id
  WHERE c.smart_id = p_checkout_smart_id
    AND c.status = 'active'
    AND pr.is_active = true
    AND (c.expires_at IS NULL OR c.expires_at > now());
END;
$$;
