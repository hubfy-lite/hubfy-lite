-- ============================================================
-- CSV Import Foundation
-- 1. orders.source — origem oficial de cada order
-- 2. customers.external_customer_id — ID na plataforma anterior
-- 3. customers.phone_country_code — DDI do telefone
-- 4. customers.user_id nullable — alinhar DDL com comportamento real
-- 5. customer_import_batches — auditoria de importações
-- 6. Backfill orders.source para dados existentes
-- 7. Atualizar RPCs afetadas
-- ============================================================

-- ─── 1. orders.source ───────────────────────────────────────
-- Adicionamos sem NOT NULL primeiro, fazemos backfill, depois aplicamos.

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS source TEXT;

-- Backfill: inferir origem dos dados existentes
UPDATE public.orders SET source = 'external_gateway'
  WHERE source IS NULL AND gateway_external_id IS NOT NULL;

UPDATE public.orders SET source = 'hubfy'
  WHERE source IS NULL AND checkout_id IS NOT NULL;

UPDATE public.orders SET source = 'unknown'
  WHERE source IS NULL;

-- Agora sim: default + NOT NULL
ALTER TABLE public.orders
  ALTER COLUMN source SET DEFAULT 'hubfy',
  ALTER COLUMN source SET NOT NULL;

-- Índice parcial para queries que excluem csv_import
CREATE INDEX IF NOT EXISTS idx_orders_source
  ON public.orders(tenant_id, source);

-- ─── 2. customers.external_customer_id ──────────────────────

ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS external_customer_id TEXT;

CREATE INDEX IF NOT EXISTS idx_customers_external_id
  ON public.customers(tenant_id, external_customer_id)
  WHERE external_customer_id IS NOT NULL;

-- ─── 3. customers.phone_country_code ────────────────────────

ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS phone_country_code TEXT;

-- ─── 4. customers.user_id nullable ──────────────────────────
-- O código (process-checkout, triggers) já assume que user_id pode ser NULL.
-- A DDL original dizia NOT NULL. Alinhamos aqui.

ALTER TABLE public.customers
  ALTER COLUMN user_id DROP NOT NULL;

-- ─── 5. customer_import_batches ─────────────────────────────

CREATE TABLE IF NOT EXISTS public.customer_import_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  imported_by UUID NOT NULL REFERENCES auth.users(id),
  filename TEXT,
  status TEXT NOT NULL DEFAULT 'processing',
  total_rows INTEGER NOT NULL DEFAULT 0,
  created_count INTEGER NOT NULL DEFAULT 0,
  updated_count INTEGER NOT NULL DEFAULT 0,
  skipped_count INTEGER NOT NULL DEFAULT 0,
  error_count INTEGER NOT NULL DEFAULT 0,
  orders_created_count INTEGER NOT NULL DEFAULT 0,
  result JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_import_batches_tenant
  ON public.customer_import_batches(tenant_id, created_at DESC);

ALTER TABLE public.customer_import_batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant editors can manage import batches"
  ON public.customer_import_batches
  FOR ALL
  USING (public.is_tenant_editor(tenant_id))
  WITH CHECK (public.is_tenant_editor(tenant_id));

-- ─── 6. Atualizar get_order_metrics — excluir csv_import ────

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
  IF NOT public.is_tenant_editor(p_tenant_id) AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

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

  RETURN result;
END;
$$;

-- ─── 7. Atualizar get_tenant_orders — retornar source + filtro ──

DROP FUNCTION IF EXISTS public.get_tenant_orders(UUID, TEXT, INTEGER, INTEGER);

CREATE OR REPLACE FUNCTION public.get_tenant_orders(
  p_tenant_id UUID,
  p_search TEXT DEFAULT NULL,
  p_page INTEGER DEFAULT 0,
  p_page_size INTEGER DEFAULT 50,
  p_source TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  public_id text,
  tenant_id UUID,
  customer_id UUID,
  product_id UUID,
  checkout_id UUID,
  price_id UUID,
  order_number INTEGER,
  type order_type,
  status order_status,
  source text,
  unit_amount INTEGER,
  currency TEXT,
  is_order_bump BOOLEAN,
  parent_gateway_external_id TEXT,
  gateway_external_id TEXT,
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
  v_search_int INTEGER;
  v_source TEXT := NULLIF(TRIM(p_source), '');
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
    AND (v_source IS NULL OR o.source = v_source)
    AND (
      v_search IS NULL
      OR (v_search_int IS NOT NULL AND o.order_number = v_search_int)
      OR COALESCE(c.name, '') ILIKE '%' || v_search || '%'
      OR c.email ILIKE '%' || v_search || '%'
      OR COALESCE(p.name, '') ILIKE '%' || v_search || '%'
    )
  ORDER BY COALESCE(o.gateway_order_created_at, o.created_at) DESC, o.id DESC
  LIMIT v_page_size
  OFFSET v_offset;
END;
$$;

-- ─── 8. Atualizar get_dashboard_metrics — excluir csv_import ──

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
  -- Autorização
  IF NOT public.is_tenant_editor(p_tenant_id) AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

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
          AND o2.source <> 'csv_import'
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
          AND o3.source <> 'csv_import'
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
          AND o4.source <> 'csv_import'
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
          AND o5.source <> 'csv_import'
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
    AND o.status IN ('approved', 'completed')
    AND o.source <> 'csv_import';

  RETURN result;
END;
$$;

-- ─── 9. get_customer_purchased_products — MANTER csv_import ──
-- Não alteramos. csv_import é o mecanismo de grant: produtos devem aparecer no portal.
-- Apenas documentamos a decisão aqui.

-- ─── 10. Portal orders (useCustomerOrders) — excluir csv_import ──
-- Isso será feito no frontend (hook), não no SQL, pois usa query direta.
