-- ============================================================
-- Superadmin: RPC functions for cross-tenant data access
-- All functions require is_admin() — manual role grant only.
-- ============================================================

-- 1. Dashboard metrics (monolithic by design)
-- NOTE: If this becomes slow at scale, split into smaller RPCs
-- and load in parallel from the frontend.
CREATE OR REPLACE FUNCTION public.get_superadmin_dashboard_metrics()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSON;
  v_now TIMESTAMPTZ := NOW();
  v_month_start TIMESTAMPTZ := DATE_TRUNC('month', v_now);
  v_last_month_start TIMESTAMPTZ := DATE_TRUNC('month', v_now - INTERVAL '1 month');
  v_today_start TIMESTAMPTZ := DATE_TRUNC('day', v_now);
  v_thirty_days_ago DATE := (v_now - INTERVAL '30 days')::DATE;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  SELECT JSON_BUILD_OBJECT(
    'total_tenants', (SELECT COUNT(*) FROM tenants),
    'total_customers', (SELECT COUNT(*) FROM customers),
    'total_revenue', COALESCE(SUM(o.unit_amount), 0),
    'total_mrr', (SELECT COALESCE(SUM(mrr_cents), 0) FROM customers),
    'revenue_this_month', COALESCE(
      SUM(o.unit_amount) FILTER (
        WHERE COALESCE(o.gateway_order_created_at, o.created_at) >= v_month_start
      ), 0
    ),
    'revenue_last_month', COALESCE(
      SUM(o.unit_amount) FILTER (
        WHERE COALESCE(o.gateway_order_created_at, o.created_at) >= v_last_month_start
          AND COALESCE(o.gateway_order_created_at, o.created_at) < v_month_start
      ), 0
    ),
    'orders_today', (
      SELECT COUNT(*)
      FROM orders
      WHERE status IN ('approved', 'completed')
        AND COALESCE(gateway_order_created_at, created_at) >= v_today_start
    ),
    'new_customers_today', (
      SELECT COUNT(*) FROM customers WHERE created_at >= v_today_start
    ),
    'revenue_by_day', (
      SELECT COALESCE(JSON_AGG(day_row ORDER BY day_row.day), '[]'::JSON)
      FROM (
        SELECT
          d.day::DATE AS day,
          COALESCE(SUM(o2.unit_amount), 0) AS revenue
        FROM GENERATE_SERIES(v_thirty_days_ago, v_now::DATE, '1 day'::INTERVAL) AS d(day)
        LEFT JOIN orders o2
          ON o2.status IN ('approved', 'completed')
          AND COALESCE(o2.gateway_order_created_at, o2.created_at)::DATE = d.day::DATE
        GROUP BY d.day
      ) day_row
    ),
    'top_tenants', (
      SELECT COALESCE(JSON_AGG(tt ORDER BY tt.revenue DESC), '[]'::JSON)
      FROM (
        SELECT
          t.id,
          t.name,
          t.slug,
          (SELECT COUNT(*) FROM customers c WHERE c.tenant_id = t.id) AS customers_count,
          (SELECT COUNT(*) FROM orders o3 WHERE o3.tenant_id = t.id AND o3.status IN ('approved', 'completed')) AS orders_count,
          COALESCE(SUM(o4.unit_amount), 0) AS revenue
        FROM tenants t
        LEFT JOIN orders o4 ON o4.tenant_id = t.id AND o4.status IN ('approved', 'completed')
        GROUP BY t.id, t.name, t.slug
        ORDER BY COALESCE(SUM(o4.unit_amount), 0) DESC
        LIMIT 10
      ) tt
    ),
    'recent_tenants', (
      SELECT COALESCE(JSON_AGG(rt ORDER BY rt.created_at DESC), '[]'::JSON)
      FROM (
        SELECT
          t.id,
          t.name,
          t.slug,
          t.created_at
        FROM tenants t
        ORDER BY t.created_at DESC
        LIMIT 10
      ) rt
    )
  ) INTO result
  FROM orders o
  WHERE o.status IN ('approved', 'completed');

  RETURN result;
END;
$$;

-- 2. Tenants list with metrics, search, sorting, pagination
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
  revenue_total BIGINT,
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
      COALESCE(os.rev, 0) AS rev_total
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
    ts.rev_total,
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

-- 3. Customers cross-tenant with search, tenant filter, pagination
CREATE OR REPLACE FUNCTION public.get_superadmin_customers(
  p_search TEXT DEFAULT NULL,
  p_tenant_id UUID DEFAULT NULL,
  p_page INTEGER DEFAULT 0,
  p_page_size INTEGER DEFAULT 50
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  email TEXT,
  phone TEXT,
  tenant_id UUID,
  tenant_name TEXT,
  total_revenue_cents INTEGER,
  mrr_cents INTEGER,
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
    c.id,
    c.name,
    c.email,
    c.phone,
    c.tenant_id,
    t.name AS tenant_name,
    c.total_revenue_cents,
    c.mrr_cents,
    c.created_at,
    COUNT(*) OVER() AS total_count
  FROM customers c
  JOIN tenants t ON t.id = c.tenant_id
  WHERE (p_tenant_id IS NULL OR c.tenant_id = p_tenant_id)
    AND (
      v_search IS NULL
      OR c.name ILIKE '%' || v_search || '%'
      OR c.email ILIKE '%' || v_search || '%'
    )
  ORDER BY c.created_at DESC, c.id DESC
  LIMIT v_page_size
  OFFSET v_offset;
END;
$$;

-- 4. Orders cross-tenant with search, tenant/status filter, pagination
CREATE OR REPLACE FUNCTION public.get_superadmin_orders(
  p_search TEXT DEFAULT NULL,
  p_tenant_id UUID DEFAULT NULL,
  p_status TEXT DEFAULT NULL,
  p_page INTEGER DEFAULT 0,
  p_page_size INTEGER DEFAULT 50
)
RETURNS TABLE (
  id UUID,
  order_number INTEGER,
  customer_name TEXT,
  customer_email TEXT,
  product_name TEXT,
  tenant_id UUID,
  tenant_name TEXT,
  unit_amount INTEGER,
  currency TEXT,
  status order_status,
  payment_method TEXT,
  effective_order_at TIMESTAMPTZ,
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
  v_status order_status;
  v_search_int INTEGER;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  -- Cast status filter safely
  IF p_status IS NOT NULL AND TRIM(p_status) <> '' THEN
    BEGIN
      v_status := TRIM(p_status)::order_status;
    EXCEPTION WHEN OTHERS THEN
      v_status := NULL;
    END;
  END IF;

  -- Try integer match for order_number
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
    o.order_number,
    COALESCE(c.name, c.email, '') AS customer_name,
    COALESCE(c.email, '') AS customer_email,
    COALESCE(p.name, '') AS product_name,
    o.tenant_id,
    t.name AS tenant_name,
    o.unit_amount,
    o.currency,
    o.status,
    o.payment_method,
    COALESCE(o.gateway_order_created_at, o.created_at) AS effective_order_at,
    COUNT(*) OVER() AS total_count
  FROM orders o
  LEFT JOIN customers c ON c.id = o.customer_id
  LEFT JOIN products p ON p.id = o.product_id
  JOIN tenants t ON t.id = o.tenant_id
  WHERE (p_tenant_id IS NULL OR o.tenant_id = p_tenant_id)
    AND (v_status IS NULL OR o.status = v_status)
    AND (
      v_search IS NULL
      OR (v_search_int IS NOT NULL AND o.order_number = v_search_int)
      OR COALESCE(c.name, '') ILIKE '%' || v_search || '%'
      OR c.email ILIKE '%' || v_search || '%'
      OR COALESCE(p.name, '') ILIKE '%' || v_search || '%'
      OR t.name ILIKE '%' || v_search || '%'
    )
  ORDER BY COALESCE(o.gateway_order_created_at, o.created_at) DESC, o.id DESC
  LIMIT v_page_size
  OFFSET v_offset;
END;
$$;

-- 5. Products cross-tenant with search, tenant filter, pagination
CREATE OR REPLACE FUNCTION public.get_superadmin_products(
  p_search TEXT DEFAULT NULL,
  p_tenant_id UUID DEFAULT NULL,
  p_page INTEGER DEFAULT 0,
  p_page_size INTEGER DEFAULT 50
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  tenant_id UUID,
  tenant_name TEXT,
  unit_amount INTEGER,
  currency TEXT,
  status product_status,
  benefit TEXT,
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
    p.id,
    p.name,
    p.tenant_id,
    t.name AS tenant_name,
    p.unit_amount,
    p.currency,
    p.status,
    p.benefit,
    p.created_at,
    COUNT(*) OVER() AS total_count
  FROM products p
  JOIN tenants t ON t.id = p.tenant_id
  WHERE (p_tenant_id IS NULL OR p.tenant_id = p_tenant_id)
    AND (
      v_search IS NULL
      OR p.name ILIKE '%' || v_search || '%'
      OR t.name ILIKE '%' || v_search || '%'
    )
  ORDER BY p.created_at DESC, p.id DESC
  LIMIT v_page_size
  OFFSET v_offset;
END;
$$;
