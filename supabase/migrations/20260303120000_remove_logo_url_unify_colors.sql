-- Migration: remove logo_url references, unify primary_color = icon_color
-- Date: 2026-03-03

-- 1. Limpar logo_url de todos os tenant_settings
UPDATE public.tenant_settings SET logo_url = NULL WHERE logo_url IS NOT NULL;

-- 2. Sincronizar primary_color = icon_color onde icon_color existe
UPDATE public.tenant_settings
SET primary_color = icon_color
WHERE icon_color IS NOT NULL AND primary_color IS DISTINCT FROM icon_color;

-- 3. Recriar get_public_checkout SEM tenant_logo_url
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
  -- product fields
  product_name text,
  product_cover_url text,
  product_status text,
  -- price fields
  unit_amount integer,
  currency text,
  price_category text,
  renewal_interval_unit text,
  renewal_interval_quantity integer,
  -- tenant fields
  tenant_name text,
  tenant_slug text,
  -- tenant settings fields (sem tenant_logo_url)
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
    ts.icon_url AS tenant_icon_url,
    ts.primary_color AS tenant_primary_color,
    ts.theme_mode::text AS tenant_theme_mode,
    ts.checkout_use_brand_colors,
    ts.checkout_bg_color,
    ts.checkout_button_color,
    ts.checkout_button_style,
    ts.checkout_font_family
  FROM public.checkouts c
  JOIN public.tenants t ON t.id = c.tenant_id
  JOIN public.tenant_settings ts ON ts.tenant_id = t.id
  JOIN public.products p ON p.id = c.product_id
  JOIN public.prices pr ON pr.id = c.price_id
  WHERE c.smart_id = p_checkout_smart_id
    AND c.status = 'active'
    AND pr.is_active = true
    AND (c.expires_at IS NULL OR c.expires_at > now());
END;
$$;

-- 4. Recriar get_public_tenant_by_slug SEM logo_url
DROP FUNCTION IF EXISTS public.get_public_tenant_by_slug(text);

CREATE OR REPLACE FUNCTION public.get_public_tenant_by_slug(
  p_slug text
)
RETURNS TABLE (
  id uuid,
  name text,
  slug text,
  description text,
  icon_url text,
  primary_color text,
  accent_color text,
  theme_mode text,
  hero_image_url text,
  portal_use_brand_colors boolean,
  portal_theme_mode text,
  portal_bg_image_url text,
  portal_button_color text,
  portal_button_style text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT
    t.id,
    t.name,
    t.slug,
    ts.description,
    ts.icon_url,
    ts.primary_color,
    ts.accent_color,
    ts.theme_mode,
    ts.hero_image_url,
    ts.portal_use_brand_colors,
    ts.portal_theme_mode,
    ts.portal_bg_image_url,
    ts.portal_button_color,
    ts.portal_button_style
  FROM public.tenants t
  JOIN public.tenant_settings ts ON ts.tenant_id = t.id
  WHERE t.slug = p_slug;
$$;
