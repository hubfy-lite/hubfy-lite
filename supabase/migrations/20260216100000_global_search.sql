-- ============================================================
-- Global Search: trigram indexes + RPC
-- ============================================================

-- 1. Enable pg_trgm extension (already available on Supabase)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 2. GIN trigram indexes for fast ILIKE searches
CREATE INDEX IF NOT EXISTS idx_courses_title_trgm
  ON public.courses USING gin (title gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_showcases_title_trgm
  ON public.showcases USING gin (title gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_assets_title_trgm
  ON public.assets USING gin (title gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_profiles_name_trgm
  ON public.profiles USING gin (name gin_trgm_ops);

-- 3. RPC: global_search
-- Searches across courses, showcases, assets, and members
-- Returns up to 5 results per category, ordered by relevance (similarity)
CREATE OR REPLACE FUNCTION public.global_search(
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
  -- Must be a member of the tenant or admin
  IF NOT public.is_tenant_member(p_tenant_id) AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  -- Normalize query
  v_query := trim(p_query);
  IF v_query = '' THEN
    RETURN;
  END IF;

  RETURN QUERY

  -- Courses
  (SELECT
    'course'::text AS category,
    c.id,
    c.title,
    CASE WHEN c.is_published THEN 'Publicado' ELSE 'Rascunho' END AS subtitle,
    '/admin/courses/' || c.id::text AS url
  FROM public.courses c
  WHERE c.tenant_id = p_tenant_id
    AND c.title ILIKE '%' || v_query || '%'
  ORDER BY similarity(c.title, v_query) DESC
  LIMIT 5)

  UNION ALL

  -- Showcases
  (SELECT
    'showcase'::text AS category,
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
    'asset'::text AS category,
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

  -- Members (name or email)
  (SELECT
    'member'::text AS category,
    tu.user_id AS id,
    COALESCE(p.name, split_part(au.email::text, '@', 1)) AS title,
    au.email::text AS subtitle,
    '/admin/members' AS url
  FROM public.tenant_users tu
  JOIN auth.users au ON au.id = tu.user_id
  LEFT JOIN public.profiles p ON p.user_id = tu.user_id
  WHERE tu.tenant_id = p_tenant_id
    AND tu.role = 'member'
    AND (
      COALESCE(p.name, '') ILIKE '%' || v_query || '%'
      OR au.email::text ILIKE '%' || v_query || '%'
    )
  ORDER BY similarity(COALESCE(p.name, au.email::text), v_query) DESC
  LIMIT 5);
END;
$$;
