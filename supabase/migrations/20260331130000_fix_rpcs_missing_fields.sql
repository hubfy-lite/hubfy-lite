-- ============================================================
-- Fix: RPCs com campos faltantes na migration 20260331120000
-- 1. get_tenant_orders — restaura gateway_order_created_at,
--    effective_order_at e ordenação por effective date
-- 2. global_search — restaura categorias lesson e order,
--    campo meta, busca por gateway_product_ids, e URLs com public_id
-- ============================================================

-- 1. get_tenant_orders — versão completa com public_id + campos faltantes
DROP FUNCTION IF EXISTS public.get_tenant_orders(UUID, TEXT, INTEGER, INTEGER);

CREATE OR REPLACE FUNCTION public.get_tenant_orders(
  p_tenant_id UUID,
  p_search TEXT DEFAULT NULL,
  p_page INTEGER DEFAULT 0,
  p_page_size INTEGER DEFAULT 50
)
RETURNS TABLE (
  id UUID,
  public_id text,
  tenant_id UUID,
  customer_id UUID,
  product_id UUID,
  checkout_id UUID,
  price_id UUID,
  order_number INTEGER,
  type order_type,
  status order_status,
  unit_amount INTEGER,
  currency TEXT,
  is_order_bump BOOLEAN,
  parent_gateway_external_id TEXT,
  gateway_external_id TEXT,
  gateway_order_created_at TIMESTAMPTZ,
  effective_order_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  customer_name TEXT,
  customer_email TEXT,
  product_name TEXT,
  product_benefit TEXT,
  total_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_page_size INTEGER := LEAST(GREATEST(p_page_size, 1), 100);
  v_offset INTEGER := GREATEST(p_page, 0) * v_page_size;
  v_search TEXT := NULLIF(TRIM(p_search), '');
  v_search_int INTEGER;
BEGIN
  IF NOT public.is_tenant_editor(p_tenant_id) AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF v_search IS NOT NULL THEN
    BEGIN
      v_search_int := v_search::INTEGER;
    EXCEPTION WHEN OTHERS THEN
      v_search_int := NULL;
    END;
  END IF;

  RETURN QUERY
  SELECT
    o.id,
    o.public_id,
    o.tenant_id,
    o.customer_id,
    o.product_id,
    o.checkout_id,
    o.price_id,
    o.order_number,
    o.type,
    o.status,
    o.unit_amount,
    o.currency,
    COALESCE(o.is_order_bump, false),
    o.parent_gateway_external_id,
    o.gateway_external_id,
    o.gateway_order_created_at,
    COALESCE(o.gateway_order_created_at, o.created_at) AS effective_order_at,
    o.created_at,
    o.updated_at,
    COALESCE(c.name, c.email, '') AS customer_name,
    COALESCE(c.email, '') AS customer_email,
    COALESCE(p.name, '') AS product_name,
    p.benefit AS product_benefit,
    COUNT(*) OVER() AS total_count
  FROM orders o
  LEFT JOIN customers c ON c.id = o.customer_id
  LEFT JOIN products p ON p.id = o.product_id
  WHERE o.tenant_id = p_tenant_id
    AND (
      v_search IS NULL
      OR (v_search_int IS NOT NULL AND o.order_number = v_search_int)
      OR COALESCE(c.name, '') ILIKE '%' || v_search || '%'
      OR c.email ILIKE '%' || v_search || '%'
      OR COALESCE(p.name, '') ILIKE '%' || v_search || '%'
    )
  ORDER BY COALESCE(o.gateway_order_created_at, o.created_at) DESC, o.id DESC
  LIMIT v_page_size
  OFFSET v_offset;
END;
$$;


-- 2. global_search — versão completa com 6 categorias, meta, public_id nas URLs
DROP FUNCTION IF EXISTS public.global_search(uuid, text);

CREATE FUNCTION public.global_search(
  p_tenant_id uuid,
  p_query text
)
RETURNS TABLE (
  category text,
  id uuid,
  public_id text,
  title text,
  subtitle text,
  meta text,
  url text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_query text;
  v_query_int integer;
BEGIN
  IF NOT public.is_tenant_editor(p_tenant_id) AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  v_query := trim(p_query);
  IF v_query = '' THEN
    RETURN;
  END IF;

  BEGIN
    v_query_int := v_query::integer;
  EXCEPTION WHEN OTHERS THEN
    v_query_int := NULL;
  END;

  RETURN QUERY

  -- Courses
  (SELECT
    'course'::text AS category,
    c.id,
    c.public_id,
    c.title,
    CASE WHEN c.is_active THEN 'active' ELSE 'inactive' END AS subtitle,
    NULL::text AS meta,
    '/admin/courses/' || c.public_id AS url
  FROM public.courses c
  WHERE c.tenant_id = p_tenant_id
    AND (c.title ILIKE '%' || v_query || '%' OR c.public_id ILIKE '%' || v_query || '%')
  ORDER BY similarity(c.title, v_query) DESC, c.created_at DESC
  LIMIT 5)

  UNION ALL

  -- Lessons
  (SELECT
    'lesson'::text AS category,
    l.id,
    l.public_id,
    l.title,
    NULL::text AS subtitle,
    cr.title AS meta,
    '/admin/courses/' || cr.public_id || '/lessons/' || l.public_id AS url
  FROM public.lessons l
  JOIN public.modules m ON m.id = l.module_id
  JOIN public.courses cr ON cr.id = m.course_id
  WHERE cr.tenant_id = p_tenant_id
    AND (l.title ILIKE '%' || v_query || '%' OR l.public_id ILIKE '%' || v_query || '%')
  ORDER BY similarity(l.title, v_query) DESC, l.created_at DESC
  LIMIT 5)

  UNION ALL

  -- Products (search by name, public_id, or gateway_product_ids)
  (SELECT
    'product'::text AS category,
    pr.id,
    pr.public_id,
    pr.name AS title,
    pr.status::text AS subtitle,
    NULL::text AS meta,
    '/admin/products/' || pr.public_id AS url
  FROM public.products pr
  WHERE pr.tenant_id = p_tenant_id
    AND (
      pr.name ILIKE '%' || v_query || '%'
      OR pr.public_id ILIKE '%' || v_query || '%'
      OR array_to_string(pr.gateway_product_ids, ' ') ILIKE '%' || v_query || '%'
    )
  ORDER BY similarity(pr.name, v_query) DESC, pr.created_at DESC
  LIMIT 5)

  UNION ALL

  -- Assets
  (SELECT
    'asset'::text AS category,
    a.id,
    a.public_id,
    a.title,
    NULL::text AS subtitle,
    a.type::text AS meta,
    '/admin/assets/' || a.public_id AS url
  FROM public.assets a
  WHERE a.tenant_id = p_tenant_id
    AND a.status <> 'deleted'
    AND (a.title ILIKE '%' || v_query || '%' OR a.public_id ILIKE '%' || v_query || '%')
  ORDER BY similarity(a.title, v_query) DESC, a.created_at DESC
  LIMIT 5)

  UNION ALL

  -- Customers
  (SELECT
    'customer'::text AS category,
    cu.id,
    cu.public_id,
    COALESCE(cu.name, split_part(cu.email, '@', 1)) AS title,
    NULL::text AS subtitle,
    cu.email AS meta,
    '/admin/customers/' || cu.public_id AS url
  FROM public.customers cu
  WHERE cu.tenant_id = p_tenant_id
    AND (
      COALESCE(cu.name, '') ILIKE '%' || v_query || '%'
      OR cu.email ILIKE '%' || v_query || '%'
      OR cu.public_id ILIKE '%' || v_query || '%'
    )
  ORDER BY similarity(COALESCE(cu.name, cu.email), v_query) DESC, cu.created_at DESC
  LIMIT 5)

  UNION ALL

  -- Orders
  (SELECT
    'order'::text AS category,
    o.id,
    o.public_id,
    COALESCE(cu.name, split_part(cu.email, '@', 1), 'Cliente') || ' — ' || COALESCE(pr.name, 'Produto') AS title,
    o.status::text AS subtitle,
    CASE
      WHEN o.unit_amount IS NOT NULL AND o.currency IS NOT NULL
      THEN o.unit_amount::text || '|' || o.currency
      ELSE NULL
    END AS meta,
    '/admin/orders/' || o.public_id AS url
  FROM public.orders o
  LEFT JOIN public.customers cu ON cu.id = o.customer_id
  LEFT JOIN public.products pr ON pr.id = o.product_id
  WHERE o.tenant_id = p_tenant_id
    AND (
      o.public_id ILIKE '%' || v_query || '%'
      OR (v_query_int IS NOT NULL AND o.order_number = v_query_int)
      OR COALESCE(o.gateway_external_id, '') ILIKE '%' || v_query || '%'
      OR COALESCE(cu.name, '') ILIKE '%' || v_query || '%'
      OR COALESCE(cu.email, '') ILIKE '%' || v_query || '%'
    )
  ORDER BY o.created_at DESC
  LIMIT 5);
END;
$$;
