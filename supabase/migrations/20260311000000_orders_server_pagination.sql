-- ============================================================
-- Orders: paginação server-side, busca e métricas agregadas
-- ============================================================

-- 1. Índice parcial para métricas (approved + completed)
CREATE INDEX IF NOT EXISTS idx_orders_tenant_status_created
  ON public.orders(tenant_id, status, created_at DESC)
  WHERE status IN ('approved', 'completed');

-- 2. RPC: métricas agregadas de vendas
CREATE OR REPLACE FUNCTION public.get_order_metrics(p_tenant_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSON;
  v_today_start TIMESTAMPTZ := DATE_TRUNC('day', NOW());
BEGIN
  -- Autorização
  IF NOT public.is_tenant_editor(p_tenant_id) AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT JSON_BUILD_OBJECT(
    'total_orders', COUNT(*),
    'revenue_today', COALESCE(SUM(o.unit_amount) FILTER (WHERE o.created_at >= v_today_start), 0),
    'revenue_total', COALESCE(SUM(o.unit_amount), 0)
  ) INTO result
  FROM orders o
  WHERE o.tenant_id = p_tenant_id
    AND o.status IN ('approved', 'completed');

  RETURN result;
END;
$$;

-- 3. RPC: listagem paginada com busca server-side
CREATE OR REPLACE FUNCTION public.get_tenant_orders(
  p_tenant_id UUID,
  p_search TEXT DEFAULT NULL,
  p_page INTEGER DEFAULT 0,
  p_page_size INTEGER DEFAULT 50
)
RETURNS TABLE (
  id UUID,
  tenant_id UUID,
  customer_id UUID,
  product_id UUID,
  checkout_id UUID,
  price_id UUID,
  order_number INTEGER,
  type order_type,
  status order_status,
  unit_amount INTEGER,
  currency TEXT,
  is_order_bump BOOLEAN,
  parent_gateway_external_id TEXT,
  gateway_external_id TEXT,
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
  v_search_int INTEGER;
BEGIN
  -- Autorização
  IF NOT public.is_tenant_editor(p_tenant_id) AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  -- Tenta converter busca para inteiro (match exato de order_number)
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
    o.tenant_id,
    o.customer_id,
    o.product_id,
    o.checkout_id,
    o.price_id,
    o.order_number,
    o.type,
    o.status,
    o.unit_amount,
    o.currency,
    COALESCE(o.is_order_bump, false),
    o.parent_gateway_external_id,
    o.gateway_external_id,
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
    AND (
      v_search IS NULL
      OR (v_search_int IS NOT NULL AND o.order_number = v_search_int)
      OR COALESCE(c.name, '') ILIKE '%' || v_search || '%'
      OR c.email ILIKE '%' || v_search || '%'
      OR COALESCE(p.name, '') ILIKE '%' || v_search || '%'
    )
  ORDER BY o.created_at DESC, o.id DESC
  LIMIT v_page_size
  OFFSET v_offset;
END;
$$;
