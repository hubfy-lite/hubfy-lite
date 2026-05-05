-- ============================================================
-- Global Search v4 — Expandir campos pesquisáveis
-- Adiciona: descrições, slugs de cursos, public_id e unaccent para melhor relevância
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
  v_query_unaccent text;
  v_query_int integer;
BEGIN
  IF NOT public.is_tenant_editor(p_tenant_id) AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  v_query := trim(p_query);
  IF v_query = '' THEN
    RETURN;
  END IF;

  -- Versão sem acentos para busca mais ampla
  v_query_unaccent := public.unaccent_text(v_query);

  -- Try to parse as integer for order_number search
  BEGIN
    v_query_int := v_query::integer;
  EXCEPTION WHEN OTHERS THEN
    v_query_int := NULL;
  END;

  RETURN QUERY

  -- Courses (search by title, description, slug, public_id)
  (SELECT
    'course'::text AS category,
    c.id,
    c.title,
    CASE WHEN c.is_active THEN 'active' ELSE 'inactive' END AS subtitle,
    NULL::text AS meta,
    '/admin/courses/' || c.public_id AS url
  FROM public.courses c
  WHERE c.tenant_id = p_tenant_id
    AND (
      c.title ILIKE '%' || v_query || '%'
      OR public.unaccent_text(c.title) ILIKE '%' || v_query_unaccent || '%'
      OR c.description ILIKE '%' || v_query || '%'
      OR public.unaccent_text(COALESCE(c.description, '')) ILIKE '%' || v_query_unaccent || '%'
      OR c.slug ILIKE '%' || v_query || '%'
      OR c.public_id ILIKE '%' || v_query || '%'
    )
  ORDER BY similarity(c.title, v_query) DESC, c.created_at DESC
  LIMIT 5)

  UNION ALL

  -- Lessons (search by title, description, content, public_id, course title)
  (SELECT
    'lesson'::text AS category,
    l.id,
    l.title,
    NULL::text AS subtitle,
    cr.title AS meta,
    '/admin/courses/' || cr.public_id || '/lessons/' || l.public_id AS url
  FROM public.lessons l
  JOIN public.modules m ON m.id = l.module_id
  JOIN public.courses cr ON cr.id = m.course_id
  WHERE cr.tenant_id = p_tenant_id
    AND (
      l.title ILIKE '%' || v_query || '%'
      OR public.unaccent_text(l.title) ILIKE '%' || v_query_unaccent || '%'
      OR l.description ILIKE '%' || v_query || '%'
      OR public.unaccent_text(COALESCE(l.description, '')) ILIKE '%' || v_query_unaccent || '%'
      OR l.content ILIKE '%' || v_query || '%'
      OR l.public_id ILIKE '%' || v_query || '%'
      OR cr.title ILIKE '%' || v_query || '%'
      OR public.unaccent_text(cr.title) ILIKE '%' || v_query_unaccent || '%'
    )
  ORDER BY similarity(l.title, v_query) DESC, l.created_at DESC
  LIMIT 5)

  UNION ALL

  -- Products (search by name, public_id, description, gateway mappings)
  (SELECT
    'product'::text AS category,
    pr.id,
    pr.name AS title,
    pr.status::text AS subtitle,
    NULL::text AS meta,
    '/admin/products/' || pr.public_id AS url
  FROM public.products pr
  WHERE pr.tenant_id = p_tenant_id
    AND (
      pr.name ILIKE '%' || v_query || '%'
      OR public.unaccent_text(pr.name) ILIKE '%' || v_query_unaccent || '%'
      OR pr.public_id ILIKE '%' || v_query || '%'
      OR pr.description ILIKE '%' || v_query || '%'
      OR public.unaccent_text(COALESCE(pr.description, '')) ILIKE '%' || v_query_unaccent || '%'
      OR EXISTS (
        SELECT 1
        FROM public.gateway_product_mappings gpm
        WHERE gpm.product_id = pr.id
          AND (
            gpm.external_product_id ILIKE '%' || v_query || '%'
            OR COALESCE(gpm.external_product_name, '') ILIKE '%' || v_query || '%'
            OR public.unaccent_text(COALESCE(gpm.external_product_name, '')) ILIKE '%' || v_query_unaccent || '%'
          )
      )
    )
  ORDER BY similarity(pr.name, v_query) DESC, pr.created_at DESC
  LIMIT 5)

  UNION ALL

  -- Assets (search by title, description, mime_type)
  (SELECT
    'asset'::text AS category,
    a.id,
    a.title,
    NULL::text AS subtitle,
    a.type::text AS meta,
    '/admin/assets/' || a.public_id AS url
  FROM public.assets a
  WHERE a.tenant_id = p_tenant_id
    AND a.status <> 'deleted'
    AND (
      a.title ILIKE '%' || v_query || '%'
      OR public.unaccent_text(a.title) ILIKE '%' || v_query_unaccent || '%'
      OR a.description ILIKE '%' || v_query || '%'
      OR public.unaccent_text(COALESCE(a.description, '')) ILIKE '%' || v_query_unaccent || '%'
      OR a.mime_type ILIKE '%' || v_query || '%'
      OR a.public_id ILIKE '%' || v_query || '%'
    )
  ORDER BY similarity(a.title, v_query) DESC, a.created_at DESC
  LIMIT 5)

  UNION ALL

  -- Customers (search by name, email, id)
  (SELECT
    'customer'::text AS category,
    cu.id,
    COALESCE(cu.name, split_part(cu.email, '@', 1)) AS title,
    NULL::text AS subtitle,
    cu.email AS meta,
    '/admin/customers/' || cu.public_id AS url
  FROM public.customers cu
  WHERE cu.tenant_id = p_tenant_id
    AND (
      COALESCE(cu.name, '') ILIKE '%' || v_query || '%'
      OR public.unaccent_text(COALESCE(cu.name, '')) ILIKE '%' || v_query_unaccent || '%'
      OR cu.email ILIKE '%' || v_query || '%'
      OR cu.public_id ILIKE '%' || v_query || '%'
    )
  ORDER BY similarity(COALESCE(cu.name, cu.email), v_query) DESC, cu.created_at DESC
  LIMIT 5)

  UNION ALL

  -- Orders (search by id, order_number, gateway_external_id, customer name/email, product name)
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
      OR public.unaccent_text(COALESCE(cu.name, '')) ILIKE '%' || v_query_unaccent || '%'
      OR COALESCE(cu.email, '') ILIKE '%' || v_query || '%'
      OR COALESCE(pr.name, '') ILIKE '%' || v_query || '%'
      OR public.unaccent_text(COALESCE(pr.name, '')) ILIKE '%' || v_query_unaccent || '%'
    )
  ORDER BY o.created_at DESC
  LIMIT 5);
END;
$$;

-- Comentário documentando as mudanças
COMMENT ON FUNCTION public.global_search(uuid, text) IS 'v4: buscas expandidas em descrições, slugs de cursos, public_id, gateway mappings e suporte a unaccent';
