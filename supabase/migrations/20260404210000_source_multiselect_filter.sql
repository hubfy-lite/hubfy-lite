-- Make p_source support comma-separated values (multi-select) in both RPCs
-- and add p_source filter to get_order_metrics.

-- ─── 1. get_tenant_orders — p_source multi-select ───

DROP FUNCTION IF EXISTS public.get_tenant_orders(UUID, TEXT, INTEGER, INTEGER, TEXT, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ);

CREATE OR REPLACE FUNCTION public.get_tenant_orders(
  p_tenant_id UUID,
  p_search TEXT DEFAULT NULL,
  p_page INTEGER DEFAULT 0,
  p_page_size INTEGER DEFAULT 50,
  p_source TEXT DEFAULT NULL,         -- comma-separated e.g. 'hubfy,csv_import'
  p_status TEXT DEFAULT NULL,         -- comma-separated e.g. 'pending,approved'
  p_product_id TEXT DEFAULT NULL,     -- comma-separated UUIDs
  p_start_at TIMESTAMPTZ DEFAULT NULL,
  p_end_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  public_id TEXT,
  tenant_id UUID,
  customer_id UUID,
  product_id UUID,
  checkout_id UUID,
  price_id UUID,
  order_number INTEGER,
  type order_type,
  status order_status,
  source TEXT,
  unit_amount INTEGER,
  currency TEXT,
  is_order_bump BOOLEAN,
  parent_gateway_external_id TEXT,
  gateway_external_id TEXT,
  gateway_provider TEXT,
  gateway_order_created_at TIMESTAMPTZ,
  effective_order_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  customer_name TEXT,
  customer_email TEXT,
  product_name TEXT,
  product_benefit TEXT,
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
  v_source TEXT := NULLIF(TRIM(p_source), '');
  v_status TEXT := NULLIF(TRIM(p_status), '');
  v_product_id TEXT := NULLIF(TRIM(p_product_id), '');
  v_search_int INTEGER;
BEGIN
  IF NOT public.is_tenant_editor(p_tenant_id) AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

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
    o.public_id,
    o.tenant_id,
    o.customer_id,
    o.product_id,
    o.checkout_id,
    o.price_id,
    o.order_number,
    o.type,
    o.status,
    o.source,
    o.unit_amount,
    o.currency,
    COALESCE(o.is_order_bump, false),
    o.parent_gateway_external_id,
    o.gateway_external_id,
    o.gateway_provider,
    o.gateway_order_created_at,
    COALESCE(o.gateway_order_created_at, o.created_at) AS effective_order_at,
    o.created_at,
    o.updated_at,
    COALESCE(c.name, c.email, '') AS customer_name,
    COALESCE(c.email, '') AS customer_email,
    COALESCE(p.name, '') AS product_name,
    p.benefit AS product_benefit,
    COUNT(*) OVER() AS total_count
  FROM orders o
  LEFT JOIN customers c ON c.id = o.customer_id
  LEFT JOIN products p ON p.id = o.product_id
  WHERE o.tenant_id = p_tenant_id
    AND (v_source IS NULL OR o.source = ANY(string_to_array(v_source, ',')))
    AND (v_status IS NULL OR o.status::TEXT = ANY(string_to_array(v_status, ',')))
    AND (v_product_id IS NULL OR o.product_id::TEXT = ANY(string_to_array(v_product_id, ',')))
    AND (p_start_at IS NULL OR COALESCE(o.gateway_order_created_at, o.created_at) >= p_start_at)
    AND (p_end_at IS NULL OR COALESCE(o.gateway_order_created_at, o.created_at) < p_end_at)
    AND (
      v_search IS NULL
      OR (v_search_int IS NOT NULL AND o.order_number = v_search_int)
      OR COALESCE(c.name, '') ILIKE '%' || v_search || '%'
      OR c.email ILIKE '%' || v_search || '%'
      OR COALESCE(p.name, '') ILIKE '%' || v_search || '%'
      OR o.gateway_external_id ILIKE '%' || v_search || '%'
    )
  ORDER BY COALESCE(o.gateway_order_created_at, o.created_at) DESC
  LIMIT v_page_size
  OFFSET v_offset;
END;
$$;

-- ─── 2. get_order_metrics — add p_source ───

DROP FUNCTION IF EXISTS public.get_order_metrics(UUID, TEXT, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ);

CREATE OR REPLACE FUNCTION public.get_order_metrics(
  p_tenant_id UUID,
  p_search TEXT DEFAULT NULL,
  p_source TEXT DEFAULT NULL,         -- comma-separated
  p_status TEXT DEFAULT NULL,         -- comma-separated
  p_product_id TEXT DEFAULT NULL,     -- comma-separated UUIDs
  p_start_at TIMESTAMPTZ DEFAULT NULL,
  p_end_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSON;
  v_today_start TIMESTAMPTZ := DATE_TRUNC('day', NOW());
  v_search TEXT := NULLIF(TRIM(p_search), '');
  v_source TEXT := NULLIF(TRIM(p_source), '');
  v_status TEXT := NULLIF(TRIM(p_status), '');
  v_product_id TEXT := NULLIF(TRIM(p_product_id), '');
  v_has_filter BOOLEAN := (
    v_search IS NOT NULL
    OR v_source IS NOT NULL
    OR v_status IS NOT NULL
    OR v_product_id IS NOT NULL
    OR p_start_at IS NOT NULL
    OR p_end_at IS NOT NULL
  );
  v_search_int INTEGER;
BEGIN
  IF NOT public.is_tenant_editor(p_tenant_id) AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF v_search IS NOT NULL THEN
    BEGIN
      v_search_int := v_search::INTEGER;
    EXCEPTION WHEN OTHERS THEN
      v_search_int := NULL;
    END;
  END IF;

  IF v_has_filter THEN
    SELECT JSON_BUILD_OBJECT(
      'total_orders', COUNT(*),
      'revenue_today', 0,
      'revenue_total', COALESCE(SUM(o.unit_amount), 0)
    ) INTO result
    FROM orders o
    LEFT JOIN customers c ON c.id = o.customer_id
    LEFT JOIN products p ON p.id = o.product_id
    WHERE o.tenant_id = p_tenant_id
      AND (v_source IS NULL OR o.source = ANY(string_to_array(v_source, ',')))
      AND (v_status IS NULL OR o.status::TEXT = ANY(string_to_array(v_status, ',')))
      AND (v_product_id IS NULL OR o.product_id::TEXT = ANY(string_to_array(v_product_id, ',')))
      AND (p_start_at IS NULL OR COALESCE(o.gateway_order_created_at, o.created_at) >= p_start_at)
      AND (p_end_at IS NULL OR COALESCE(o.gateway_order_created_at, o.created_at) < p_end_at)
      AND (
        v_search IS NULL
        OR (v_search_int IS NOT NULL AND o.order_number = v_search_int)
        OR COALESCE(c.name, '') ILIKE '%' || v_search || '%'
        OR c.email ILIKE '%' || v_search || '%'
        OR COALESCE(p.name, '') ILIKE '%' || v_search || '%'
        OR o.gateway_external_id ILIKE '%' || v_search || '%'
      );
  ELSE
    SELECT JSON_BUILD_OBJECT(
      'total_orders', COUNT(*),
      'revenue_today', COALESCE(
        SUM(o.unit_amount) FILTER (
          WHERE COALESCE(o.gateway_order_created_at, o.created_at) >= v_today_start
        ),
        0
      ),
      'revenue_total', COALESCE(SUM(o.unit_amount), 0)
    ) INTO result
    FROM orders o
    WHERE o.tenant_id = p_tenant_id
      AND o.status IN ('approved', 'completed')
      AND o.source <> 'csv_import';
  END IF;

  RETURN result;
END;
$$;
