-- ============================================================
-- 1. Add used_tools filter + owner_whatsapp to get_superadmin_tenants
-- 2. Add whatsapp to get_superadmin_tenant_users
-- ============================================================

-- 1. get_superadmin_tenants
DROP FUNCTION IF EXISTS public.get_superadmin_tenants(TEXT, INTEGER, INTEGER, TEXT, TEXT, TEXT[], TEXT[], TEXT[]);

CREATE OR REPLACE FUNCTION public.get_superadmin_tenants(
  p_search TEXT DEFAULT NULL,
  p_page INTEGER DEFAULT 0,
  p_page_size INTEGER DEFAULT 50,
  p_sort_by TEXT DEFAULT 'created_at',
  p_sort_dir TEXT DEFAULT 'desc',
  p_goals TEXT[] DEFAULT NULL,
  p_customer_counts TEXT[] DEFAULT NULL,
  p_annual_revenues TEXT[] DEFAULT NULL,
  p_used_tools TEXT[] DEFAULT NULL
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
  owner_whatsapp TEXT,
  onboarding_goal TEXT,
  referral_source TEXT,
  customer_count TEXT,
  annual_revenue TEXT,
  used_tools JSONB,
  total_count BIGINT,
  stat_total BIGINT,
  stat_migrate BIGINT,
  stat_onboarding_complete BIGINT,
  stat_recent_7d BIGINT
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
  WITH global_stats AS (
    SELECT
      COUNT(*) AS s_total,
      COUNT(*) FILTER (WHERE tp2.onboarding_goal = 'migrate') AS s_migrate,
      COUNT(*) FILTER (
        WHERE tp2.onboarding_goal IS NOT NULL
          AND tp2.annual_revenue IS NOT NULL
          AND tp2.used_tools IS NOT NULL
          AND jsonb_array_length(COALESCE(tp2.used_tools, '[]'::jsonb)) > 0
      ) AS s_onboarding_complete,
      COUNT(*) FILTER (WHERE t2.created_at >= now() - interval '7 days') AS s_recent_7d
    FROM tenants t2
    LEFT JOIN tenant_profile tp2 ON tp2.tenant_id = t2.id
  ),
  tenant_stats AS (
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
      ow.oemail::TEXT AS owner_email,
      ow.owhatsapp::TEXT AS owner_whatsapp,
      tp.onboarding_goal,
      tp.referral_source,
      tp.customer_count,
      tp.annual_revenue,
      tp.used_tools
    FROM tenants t
    LEFT JOIN tenant_profile tp ON tp.tenant_id = t.id
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
        au.email::TEXT AS oemail,
        pr.whatsapp::TEXT AS owhatsapp
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
    AND (p_goals IS NULL OR COALESCE(array_length(p_goals, 1), 0) = 0 OR tp.onboarding_goal = ANY(p_goals))
    AND (p_customer_counts IS NULL OR COALESCE(array_length(p_customer_counts, 1), 0) = 0 OR tp.customer_count = ANY(p_customer_counts))
    AND (p_annual_revenues IS NULL OR COALESCE(array_length(p_annual_revenues, 1), 0) = 0 OR tp.annual_revenue = ANY(p_annual_revenues))
    AND (p_used_tools IS NULL OR COALESCE(array_length(p_used_tools, 1), 0) = 0
         OR EXISTS (
           SELECT 1 FROM jsonb_array_elements_text(COALESCE(tp.used_tools, '[]'::jsonb)) tool
           WHERE tool = ANY(p_used_tools)
         ))
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
    ts.owner_whatsapp,
    ts.onboarding_goal,
    ts.referral_source,
    ts.customer_count,
    ts.annual_revenue,
    ts.used_tools,
    COUNT(*) OVER() AS total_count,
    gs.s_total,
    gs.s_migrate,
    gs.s_onboarding_complete,
    gs.s_recent_7d
  FROM tenant_stats ts
  CROSS JOIN global_stats gs
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

-- 2. get_superadmin_tenant_users — add whatsapp
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
  whatsapp TEXT,
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
    pr.whatsapp::TEXT,
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
