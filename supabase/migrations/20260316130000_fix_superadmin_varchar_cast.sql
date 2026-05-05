-- ============================================================
-- Fix: cast VARCHAR(255) columns to TEXT in superadmin RPCs
-- auth.users.email and profiles.name are VARCHAR(255) but
-- RETURNS TABLE declares TEXT — PostgreSQL rejects the mismatch.
-- ============================================================

-- 1. get_superadmin_tenants: owner_name and owner_email
DROP FUNCTION IF EXISTS public.get_superadmin_tenants(TEXT, INTEGER, INTEGER, TEXT, TEXT);
CREATE OR REPLACE FUNCTION public.get_superadmin_tenants(
  p_search TEXT DEFAULT NULL,
  p_page INTEGER DEFAULT 0,
  p_page_size INTEGER DEFAULT 50,
  p_sort_by TEXT DEFAULT 'created_at',
  p_sort_dir TEXT DEFAULT 'desc'
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  slug TEXT,
  created_at TIMESTAMPTZ,
  customers_count BIGINT,
  orders_count BIGINT,
  products_count BIGINT,
  courses_count BIGINT,
  revenue_total BIGINT,
  owner_name TEXT,
  owner_email TEXT,
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
  v_sort_by TEXT := COALESCE(NULLIF(TRIM(p_sort_by), ''), 'created_at');
  v_sort_dir TEXT := CASE WHEN LOWER(TRIM(p_sort_dir)) = 'asc' THEN 'asc' ELSE 'desc' END;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  RETURN QUERY
  WITH tenant_stats AS (
    SELECT
      t.id AS tid,
      t.name AS tname,
      t.slug AS tslug,
      t.created_at AS tcreated,
      COALESCE(cs.cnt, 0) AS cust_count,
      COALESCE(os.cnt, 0) AS ord_count,
      COALESCE(ps.cnt, 0) AS prod_count,
      COALESCE(crs.cnt, 0) AS crs_count,
      COALESCE(os.rev, 0) AS rev_total,
      ow.oname::TEXT AS owner_name,
      ow.oemail::TEXT AS owner_email
    FROM tenants t
    LEFT JOIN LATERAL (
      SELECT COUNT(*) AS cnt FROM customers c WHERE c.tenant_id = t.id
    ) cs ON TRUE
    LEFT JOIN LATERAL (
      SELECT COUNT(*) AS cnt, COALESCE(SUM(o.unit_amount), 0) AS rev
      FROM orders o WHERE o.tenant_id = t.id AND o.status IN ('approved', 'completed')
    ) os ON TRUE
    LEFT JOIN LATERAL (
      SELECT COUNT(*) AS cnt FROM products p WHERE p.tenant_id = t.id
    ) ps ON TRUE
    LEFT JOIN LATERAL (
      SELECT COUNT(*) AS cnt FROM courses cr WHERE cr.tenant_id = t.id
    ) crs ON TRUE
    LEFT JOIN LATERAL (
      SELECT
        COALESCE(pr.name, au.email)::TEXT AS oname,
        au.email::TEXT AS oemail
      FROM tenant_users tu
      JOIN auth.users au ON au.id = tu.user_id
      LEFT JOIN profiles pr ON pr.user_id = tu.user_id
      WHERE tu.tenant_id = t.id AND tu.role = 'owner'
      LIMIT 1
    ) ow ON TRUE
    WHERE (
      v_search IS NULL
      OR t.name ILIKE '%' || v_search || '%'
      OR t.slug ILIKE '%' || v_search || '%'
    )
  )
  SELECT
    ts.tid,
    ts.tname,
    ts.tslug,
    ts.tcreated,
    ts.cust_count,
    ts.ord_count,
    ts.prod_count,
    ts.crs_count,
    ts.rev_total,
    ts.owner_name,
    ts.owner_email,
    COUNT(*) OVER() AS total_count
  FROM tenant_stats ts
  ORDER BY
    CASE WHEN v_sort_dir = 'asc' THEN
      CASE v_sort_by
        WHEN 'name' THEN ts.tname
        WHEN 'created_at' THEN ts.tcreated::TEXT
        WHEN 'revenue' THEN LPAD(ts.rev_total::TEXT, 20, '0')
        WHEN 'customers' THEN LPAD(ts.cust_count::TEXT, 10, '0')
        ELSE ts.tcreated::TEXT
      END
    END ASC NULLS LAST,
    CASE WHEN v_sort_dir = 'desc' THEN
      CASE v_sort_by
        WHEN 'name' THEN ts.tname
        WHEN 'created_at' THEN ts.tcreated::TEXT
        WHEN 'revenue' THEN LPAD(ts.rev_total::TEXT, 20, '0')
        WHEN 'customers' THEN LPAD(ts.cust_count::TEXT, 10, '0')
        ELSE ts.tcreated::TEXT
      END
    END DESC NULLS LAST
  LIMIT v_page_size
  OFFSET v_offset;
END;
$$;

-- 2. get_superadmin_tenant_users: name and email
DROP FUNCTION IF EXISTS public.get_superadmin_tenant_users(TEXT, UUID, INTEGER, INTEGER);
CREATE OR REPLACE FUNCTION public.get_superadmin_tenant_users(
  p_search TEXT DEFAULT NULL,
  p_tenant_id UUID DEFAULT NULL,
  p_page INTEGER DEFAULT 0,
  p_page_size INTEGER DEFAULT 50
)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  tenant_id UUID,
  tenant_name TEXT,
  name TEXT,
  email TEXT,
  role TEXT,
  status TEXT,
  last_sign_in_at TIMESTAMPTZ,
  email_confirmed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
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
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  RETURN QUERY
  SELECT
    tu.id,
    tu.user_id,
    tu.tenant_id,
    t.name::TEXT AS tenant_name,
    COALESCE(pr.name, au.email)::TEXT AS name,
    au.email::TEXT,
    tu.role::TEXT,
    COALESCE(tu.status, 'active')::TEXT AS status,
    au.last_sign_in_at,
    au.email_confirmed_at,
    tu.created_at,
    COUNT(*) OVER() AS total_count
  FROM tenant_users tu
  JOIN auth.users au ON au.id = tu.user_id
  JOIN tenants t ON t.id = tu.tenant_id
  LEFT JOIN profiles pr ON pr.user_id = tu.user_id
  WHERE (p_tenant_id IS NULL OR tu.tenant_id = p_tenant_id)
    AND (
      v_search IS NULL
      OR COALESCE(pr.name, '')::TEXT ILIKE '%' || v_search || '%'
      OR au.email::TEXT ILIKE '%' || v_search || '%'
      OR t.name::TEXT ILIKE '%' || v_search || '%'
    )
  ORDER BY tu.created_at DESC, tu.id DESC
  LIMIT v_page_size
  OFFSET v_offset;
END;
$$;
