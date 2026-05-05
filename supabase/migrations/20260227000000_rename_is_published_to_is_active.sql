-- Rename is_published → is_active on courses and lessons
-- Also change default to true (courses are born active)

-- ===== COURSES =====
ALTER TABLE public.courses RENAME COLUMN is_published TO is_active;
ALTER TABLE public.courses ALTER COLUMN is_active SET DEFAULT true;

-- ===== LESSONS =====
ALTER TABLE public.lessons RENAME COLUMN is_published TO is_active;
ALTER TABLE public.lessons ALTER COLUMN is_active SET DEFAULT true;

-- ===== RLS: update policies that reference is_published =====
-- Drop and recreate the courses SELECT policy
DROP POLICY IF EXISTS "Published courses are public" ON public.courses;
CREATE POLICY "Active courses are public"
  ON public.courses FOR SELECT
  USING (
    is_active = true
    OR public.is_tenant_editor(tenant_id)
    OR public.is_admin()
  );

-- ===== GLOBAL SEARCH: drop + recreate function to use is_active =====
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
  IF NOT public.is_tenant_customer(p_tenant_id) AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  v_query := trim(p_query);
  IF v_query = '' THEN
    RETURN;
  END IF;

  RETURN QUERY

  -- Courses
  (SELECT
    'course'::text AS cat,
    c.id,
    c.title,
    CASE WHEN c.is_active THEN 'Ativo' ELSE 'Inativo' END AS subtitle,
    '/admin/courses/' || c.id::text AS url
  FROM public.courses c
  WHERE c.tenant_id = p_tenant_id
    AND c.title ILIKE '%' || v_query || '%'
  ORDER BY similarity(c.title, v_query) DESC
  LIMIT 5)

  UNION ALL

  -- Products
  (SELECT
    'product'::text AS cat,
    pr.id,
    pr.name AS title,
    pr.status::text AS subtitle,
    '/admin/products' AS url
  FROM public.products pr
  WHERE pr.tenant_id = p_tenant_id
    AND pr.name ILIKE '%' || v_query || '%'
  ORDER BY similarity(pr.name, v_query) DESC
  LIMIT 5)

  UNION ALL

  -- Showcases
  (SELECT
    'showcase'::text AS cat,
    s.id,
    s.title,
    CASE WHEN s.is_public THEN 'Pública' ELSE 'Privada' END AS subtitle,
    '/admin/showcase' AS url
  FROM public.showcases s
  WHERE s.tenant_id = p_tenant_id
    AND s.title ILIKE '%' || v_query || '%'
  ORDER BY similarity(s.title, v_query) DESC
  LIMIT 5)

  UNION ALL

  -- Assets
  (SELECT
    'asset'::text AS cat,
    a.id,
    a.title,
    a.type::text AS subtitle,
    '/admin/assets' AS url
  FROM public.assets a
  WHERE a.tenant_id = p_tenant_id
    AND a.status <> 'deleted'
    AND a.title ILIKE '%' || v_query || '%'
  ORDER BY similarity(a.title, v_query) DESC
  LIMIT 5)

  UNION ALL

  -- Customers
  (SELECT
    'customer'::text AS cat,
    cu.id,
    COALESCE(cu.name, split_part(cu.email, '@', 1)) AS title,
    cu.email AS subtitle,
    '/admin/customers' AS url
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
