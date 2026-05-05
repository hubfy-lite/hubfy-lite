-- Improve dashboard metrics:
-- 1. Align status filter to 'approved' + 'completed' (matching get_order_metrics)
-- 2. Keep COALESCE(gateway_order_created_at, created_at) for effective date

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
