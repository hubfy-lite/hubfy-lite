-- Add recent_sales and top_products to dashboard metrics RPC

CREATE OR REPLACE FUNCTION public.get_dashboard_metrics(p_tenant_id UUID)
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
  v_seven_days_ago DATE := (v_now - INTERVAL '7 days')::DATE;
BEGIN
  SELECT JSON_BUILD_OBJECT(
    'revenue_total', COALESCE(SUM(o.unit_amount), 0),
    'revenue_this_month', COALESCE(SUM(o.unit_amount) FILTER (WHERE COALESCE(o.gateway_order_created_at, o.created_at) >= v_month_start), 0),
    'revenue_last_month', COALESCE(SUM(o.unit_amount) FILTER (WHERE COALESCE(o.gateway_order_created_at, o.created_at) >= v_last_month_start AND COALESCE(o.gateway_order_created_at, o.created_at) < v_month_start), 0),
    'orders_count', COUNT(*),
    'revenue_by_day', (
      SELECT COALESCE(JSON_AGG(day_row ORDER BY day_row.day), '[]'::JSON)
      FROM (
        SELECT
          d.day::DATE AS day,
          COALESCE(SUM(o2.unit_amount), 0) AS revenue
        FROM GENERATE_SERIES(v_seven_days_ago, v_now::DATE, '1 day'::INTERVAL) AS d(day)
        LEFT JOIN orders o2
          ON o2.tenant_id = p_tenant_id
          AND o2.status IN ('approved', 'completed')
          AND COALESCE(o2.gateway_order_created_at, o2.created_at)::DATE = d.day::DATE
        GROUP BY d.day
      ) day_row
    ),
    'revenue_by_payment_method', (
      SELECT COALESCE(JSON_AGG(pm_row), '[]'::JSON)
      FROM (
        SELECT
          o3.payment_method AS method,
          SUM(o3.unit_amount) AS revenue
        FROM orders o3
        WHERE o3.tenant_id = p_tenant_id
          AND o3.status IN ('approved', 'completed')
          AND o3.payment_method IS NOT NULL
        GROUP BY o3.payment_method
      ) pm_row
    ),
    'recent_sales', (
      SELECT COALESCE(JSON_AGG(rs), '[]'::JSON)
      FROM (
        SELECT
          o4.id,
          COALESCE(c.name, c.email, '') AS customer_name,
          COALESCE(c.email, '') AS customer_email,
          COALESCE(p.name, '') AS product_name,
          o4.unit_amount,
          o4.status::TEXT AS status,
          COALESCE(o4.gateway_order_created_at, o4.created_at) AS effective_order_at
        FROM orders o4
        LEFT JOIN customers c ON c.id = o4.customer_id
        LEFT JOIN products p ON p.id = o4.product_id
        WHERE o4.tenant_id = p_tenant_id
          AND o4.status IN ('approved', 'completed')
        ORDER BY COALESCE(o4.gateway_order_created_at, o4.created_at) DESC
        LIMIT 5
      ) rs
    ),
    'top_products', (
      SELECT COALESCE(JSON_AGG(tp ORDER BY tp.revenue DESC), '[]'::JSON)
      FROM (
        SELECT
          p2.name AS product_name,
          COUNT(*) AS sales_count,
          SUM(o5.unit_amount) AS revenue
        FROM orders o5
        JOIN products p2 ON p2.id = o5.product_id
        WHERE o5.tenant_id = p_tenant_id
          AND o5.status IN ('approved', 'completed')
          AND o5.product_id IS NOT NULL
        GROUP BY p2.id, p2.name
        ORDER BY SUM(o5.unit_amount) DESC
        LIMIT 5
      ) tp
    ),
    'products_count', (
      SELECT COUNT(*) FROM products WHERE tenant_id = p_tenant_id
    ),
    'courses_count', (
      SELECT COUNT(*) FROM courses WHERE tenant_id = p_tenant_id
    )
  ) INTO result
  FROM orders o
  WHERE o.tenant_id = p_tenant_id
    AND o.status IN ('approved', 'completed');

  RETURN result;
END;
$$;
