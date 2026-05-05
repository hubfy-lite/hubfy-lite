-- ============================================================
-- P1: Global Search v2
-- ============================================================
-- Returns: category, id, title, subtitle (status code), meta (literal), url
--   subtitle = translatable status code (active, draft, completed, etc.)
--   meta     = literal text not to be translated (email, course name, amount)
-- ============================================================

-- 1. Trigram index on lessons.title
CREATE INDEX IF NOT EXISTS idx_lessons_title_trgm
  ON public.lessons USING gin (title gin_trgm_ops);

-- 2. Replace global_search with v2
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
BEGIN
  IF NOT public.is_tenant_editor(p_tenant_id) AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  v_query := trim(p_query);
  IF v_query = '' THEN
    RETURN;
  END IF;

  RETURN QUERY

  -- Courses (search by title)
  -- subtitle = status code, meta = null
  (SELECT
    'course'::text AS category,
    c.id,
    c.title,
    CASE WHEN c.is_active THEN 'active' ELSE 'inactive' END AS subtitle,
    NULL::text AS meta,
    '/admin/courses/' || c.id::text AS url
  FROM public.courses c
  WHERE c.tenant_id = p_tenant_id
    AND c.title ILIKE '%' || v_query || '%'
  ORDER BY similarity(c.title, v_query) DESC
  LIMIT 5)

  UNION ALL

  -- Lessons (search by title)
  -- subtitle = null, meta = course name
  (SELECT
    'lesson'::text AS category,
    l.id,
    l.title,
    NULL::text AS subtitle,
    cr.title AS meta,
    '/admin/courses/' || cr.id::text || '/lessons/' || l.id::text AS url
  FROM public.lessons l
  JOIN public.modules m ON m.id = l.module_id
  JOIN public.courses cr ON cr.id = m.course_id
  WHERE cr.tenant_id = p_tenant_id
    AND l.title ILIKE '%' || v_query || '%'
  ORDER BY similarity(l.title, v_query) DESC
  LIMIT 5)

  UNION ALL

  -- Products (search by name, id, or gateway_product_id)
  -- subtitle = status code, meta = null
  (SELECT
    'product'::text AS category,
    pr.id,
    pr.name AS title,
    pr.status::text AS subtitle,
    NULL::text AS meta,
    '/admin/products/' || pr.id::text AS url
  FROM public.products pr
  WHERE pr.tenant_id = p_tenant_id
    AND (
      pr.name ILIKE '%' || v_query || '%'
      OR pr.id::text ILIKE '%' || v_query || '%'
      OR COALESCE(pr.gateway_product_id, '') ILIKE '%' || v_query || '%'
    )
  ORDER BY similarity(pr.name, v_query) DESC
  LIMIT 5)

  UNION ALL

  -- Assets (search by title)
  -- subtitle = null, meta = asset type
  (SELECT
    'asset'::text AS category,
    a.id,
    a.title,
    NULL::text AS subtitle,
    a.type::text AS meta,
    '/admin/assets/' || a.id::text AS url
  FROM public.assets a
  WHERE a.tenant_id = p_tenant_id
    AND a.status <> 'deleted'
    AND a.title ILIKE '%' || v_query || '%'
  ORDER BY similarity(a.title, v_query) DESC
  LIMIT 5)

  UNION ALL

  -- Customers (search by name, email, or id)
  -- subtitle = null, meta = email
  (SELECT
    'customer'::text AS category,
    cu.id,
    COALESCE(cu.name, split_part(cu.email, '@', 1)) AS title,
    NULL::text AS subtitle,
    cu.email AS meta,
    '/admin/customers/' || cu.id::text AS url
  FROM public.customers cu
  WHERE cu.tenant_id = p_tenant_id
    AND (
      COALESCE(cu.name, '') ILIKE '%' || v_query || '%'
      OR cu.email ILIKE '%' || v_query || '%'
      OR cu.id::text ILIKE '%' || v_query || '%'
    )
  ORDER BY similarity(COALESCE(cu.name, cu.email), v_query) DESC
  LIMIT 5)

  UNION ALL

  -- Orders (search by id, gateway_external_id, or customer name/email)
  -- subtitle = status code, meta = unit_amount|currency (formatted by frontend)
  (SELECT
    'order'::text AS category,
    o.id,
    COALESCE(cu.name, split_part(cu.email, '@', 1)) || ' — ' || pr.name AS title,
    o.status::text AS subtitle,
    o.unit_amount::text || '|' || o.currency AS meta,
    '/admin/orders/' || o.id::text AS url
  FROM public.orders o
  JOIN public.customers cu ON cu.id = o.customer_id
  JOIN public.products pr ON pr.id = o.product_id
  WHERE o.tenant_id = p_tenant_id
    AND (
      o.id::text ILIKE '%' || v_query || '%'
      OR COALESCE(o.gateway_external_id, '') ILIKE '%' || v_query || '%'
      OR COALESCE(cu.name, '') ILIKE '%' || v_query || '%'
      OR cu.email ILIKE '%' || v_query || '%'
    )
  ORDER BY o.created_at DESC
  LIMIT 5);
END;
$$;
