-- ============================================================
-- Converte gateway_product_id (text) → gateway_product_ids (text[])
-- para suportar múltiplos IDs externos por produto
-- ============================================================

-- 1. Cria nova coluna array
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS gateway_product_ids text[] NOT NULL DEFAULT '{}';

-- 2. Migra dados existentes
UPDATE public.products
  SET gateway_product_ids = ARRAY[gateway_product_id]
  WHERE gateway_product_id IS NOT NULL
    AND gateway_product_id != '';

-- 3. Remove coluna antiga e seu índice
DROP INDEX IF EXISTS idx_products_gateway_product_id;
ALTER TABLE public.products DROP COLUMN IF EXISTS gateway_product_id;

-- 4. Novo índice GIN para busca eficiente com @> (contains)
CREATE INDEX IF NOT EXISTS idx_products_gateway_product_ids
  ON public.products USING GIN (gateway_product_ids)
  WHERE gateway_product_ids != '{}';

-- 5. Recria global_search com gateway_product_ids (array)
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
    c.title,
    CASE WHEN c.is_active THEN 'active' ELSE 'inactive' END AS subtitle,
    NULL::text AS meta,
    '/admin/courses/' || c.id::text AS url
  FROM public.courses c
  WHERE c.tenant_id = p_tenant_id
    AND c.title ILIKE '%' || v_query || '%'
  ORDER BY similarity(c.title, v_query) DESC, c.created_at DESC
  LIMIT 5)

  UNION ALL

  -- Lessons
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
  ORDER BY similarity(l.title, v_query) DESC, l.created_at DESC
  LIMIT 5)

  UNION ALL

  -- Products (search by name, id, or gateway_product_ids)
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
      OR array_to_string(pr.gateway_product_ids, ' ') ILIKE '%' || v_query || '%'
    )
  ORDER BY similarity(pr.name, v_query) DESC, pr.created_at DESC
  LIMIT 5)

  UNION ALL

  -- Assets
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
  ORDER BY similarity(a.title, v_query) DESC, a.created_at DESC
  LIMIT 5)

  UNION ALL

  -- Customers
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
  ORDER BY similarity(COALESCE(cu.name, cu.email), v_query) DESC, cu.created_at DESC
  LIMIT 5)

  UNION ALL

  -- Orders
  (SELECT
    'order'::text AS category,
    o.id,
    COALESCE(cu.name, split_part(cu.email, '@', 1), 'Cliente') || ' — ' || COALESCE(pr.name, 'Produto') AS title,
    o.status::text AS subtitle,
    CASE
      WHEN o.unit_amount IS NOT NULL AND o.currency IS NOT NULL
      THEN o.unit_amount::text || '|' || o.currency
      ELSE NULL
    END AS meta,
    '/admin/orders/' || o.id::text AS url
  FROM public.orders o
  LEFT JOIN public.customers cu ON cu.id = o.customer_id
  LEFT JOIN public.products pr ON pr.id = o.product_id
  WHERE o.tenant_id = p_tenant_id
    AND (
      o.id::text ILIKE '%' || v_query || '%'
      OR (v_query_int IS NOT NULL AND o.order_number = v_query_int)
      OR COALESCE(o.gateway_external_id, '') ILIKE '%' || v_query || '%'
      OR COALESCE(cu.name, '') ILIKE '%' || v_query || '%'
      OR COALESCE(cu.email, '') ILIKE '%' || v_query || '%'
    )
  ORDER BY o.created_at DESC
  LIMIT 5);
END;
$$;
