-- ============================================================
-- P0: Security fixes + Global Search cleanup
-- ============================================================
-- Fixes:
--   1. Authorization: is_tenant_customer → is_tenant_editor on global_search
--      (SECURITY DEFINER + is_tenant_customer allowed portal customers
--       to search admin data: inactive courses, assets, customer emails)
--   2. Authorization: is_tenant_customer → is_tenant_editor on get_tenant_customers
--      (same vulnerability: portal customers could list all tenant customers)
--   3. Remove showcases from global search (no longer needed)
--   4. Direct URLs: products → /admin/products/:id,
--      customers → /admin/customers/:id,
--      assets → /admin/assets/:id
--   5. Subtitles as i18n-safe codes instead of hardcoded Portuguese
-- ============================================================

DROP FUNCTION IF EXISTS public.global_search(uuid, text);

CREATE FUNCTION public.global_search(
  p_tenant_id uuid,
  p_query text
)
RETURNS TABLE (
  category text,
  id uuid,
  title text,
  subtitle text,
  url text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_query text;
BEGIN
  -- P0 FIX: Only editors (owner/editor) and admins can use global search.
  -- Previously used is_tenant_customer which includes portal customers.
  IF NOT public.is_tenant_editor(p_tenant_id) AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  v_query := trim(p_query);
  IF v_query = '' THEN
    RETURN;
  END IF;

  RETURN QUERY

  -- Courses (title search, direct URL)
  (SELECT
    'course'::text AS category,
    c.id,
    c.title,
    CASE WHEN c.is_active THEN 'active' ELSE 'inactive' END AS subtitle,
    '/admin/courses/' || c.id::text AS url
  FROM public.courses c
  WHERE c.tenant_id = p_tenant_id
    AND c.title ILIKE '%' || v_query || '%'
  ORDER BY similarity(c.title, v_query) DESC
  LIMIT 5)

  UNION ALL

  -- Products (name search, direct URL with :id)
  (SELECT
    'product'::text AS category,
    pr.id,
    pr.name AS title,
    pr.status::text AS subtitle,
    '/admin/products/' || pr.id::text AS url
  FROM public.products pr
  WHERE pr.tenant_id = p_tenant_id
    AND pr.name ILIKE '%' || v_query || '%'
  ORDER BY similarity(pr.name, v_query) DESC
  LIMIT 5)

  UNION ALL

  -- Assets (title search, direct URL)
  (SELECT
    'asset'::text AS category,
    a.id,
    a.title,
    a.type::text AS subtitle,
    '/admin/assets/' || a.id::text AS url
  FROM public.assets a
  WHERE a.tenant_id = p_tenant_id
    AND a.status <> 'deleted'
    AND a.title ILIKE '%' || v_query || '%'
  ORDER BY similarity(a.title, v_query) DESC
  LIMIT 5)

  UNION ALL

  -- Customers (name or email search, direct URL)
  (SELECT
    'customer'::text AS category,
    cu.id,
    COALESCE(cu.name, split_part(cu.email, '@', 1)) AS title,
    cu.email AS subtitle,
    '/admin/customers/' || cu.id::text AS url
  FROM public.customers cu
  WHERE cu.tenant_id = p_tenant_id
    AND (
      COALESCE(cu.name, '') ILIKE '%' || v_query || '%'
      OR cu.email ILIKE '%' || v_query || '%'
    )
  ORDER BY similarity(COALESCE(cu.name, cu.email), v_query) DESC
  LIMIT 5);
END;
$$;

-- ============================================================
-- P0 FIX: get_tenant_customers — is_tenant_customer → is_tenant_editor
-- Previously a portal customer could list ALL tenant customers with emails,
-- phone numbers, revenue data, and documents.
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_tenant_customers(
  p_tenant_id uuid,
  p_search text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  email text,
  name text,
  first_name text,
  last_name text,
  document_type text,
  document text,
  avatar_url text,
  phone text,
  city text,
  region text,
  country text,
  email_marketing_status text,
  total_revenue_cents integer,
  mrr_cents integer,
  currency text,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  IF NOT public.is_tenant_editor(p_tenant_id) AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN QUERY
  SELECT
    c.id,
    c.user_id,
    c.email,
    COALESCE(c.name, p.name, split_part(c.email, '@', 1)) AS name,
    c.first_name,
    c.last_name,
    c.document_type,
    c.document,
    p.avatar_url,
    c.phone,
    c.city,
    c.region,
    c.country,
    c.email_marketing_status::text,
    c.total_revenue_cents,
    c.mrr_cents,
    c.currency,
    c.created_at,
    c.updated_at
  FROM public.customers c
  LEFT JOIN public.profiles p ON p.user_id = c.user_id
  WHERE c.tenant_id = p_tenant_id
    AND (
      p_search IS NULL
      OR p_search = ''
      OR COALESCE(c.name, '') ILIKE '%' || p_search || '%'
      OR c.email ILIKE '%' || p_search || '%'
      OR COALESCE(c.phone, '') ILIKE '%' || p_search || '%'
    )
  ORDER BY c.created_at DESC;
END;
$$;
