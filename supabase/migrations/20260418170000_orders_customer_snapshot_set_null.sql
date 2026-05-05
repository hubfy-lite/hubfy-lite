-- ============================================================
-- Migration: Snapshots de customer em orders + FK ON DELETE SET NULL
--
-- Ao apagar um customer via API pública, os orders devem ser preservados
-- (estilo Stripe). Mas o customer_id fica null — pra nao perder
-- nome/email no histórico, guardamos snapshots.
--
-- Mudanças:
-- 1. Novas colunas orders.customer_email_snapshot e customer_name_snapshot
-- 2. Backfill dos orders existentes com os dados atuais do customer
-- 3. Trigger BEFORE INSERT pra preencher snapshots automaticamente
-- 4. FK orders.customer_id passa de ON DELETE CASCADE pra ON DELETE SET NULL
-- 5. customer_id vira nullable
-- 6. get_tenant_orders faz COALESCE(customer, snapshot) pra manter o admin consistente
-- ============================================================

-- ─── 1. Adicionar colunas snapshot ───
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS customer_email_snapshot TEXT,
  ADD COLUMN IF NOT EXISTS customer_name_snapshot TEXT;

COMMENT ON COLUMN public.orders.customer_email_snapshot IS 'Email do customer no momento do pedido. Preservado mesmo após o customer ser apagado.';
COMMENT ON COLUMN public.orders.customer_name_snapshot IS 'Nome do customer no momento do pedido. Preservado mesmo após o customer ser apagado.';

-- ─── 2. Backfill dos orders existentes ───
UPDATE public.orders o
SET
  customer_email_snapshot = c.email,
  customer_name_snapshot = c.name
FROM public.customers c
WHERE o.customer_id = c.id
  AND (o.customer_email_snapshot IS NULL OR o.customer_name_snapshot IS NULL);

-- ─── 3. Tornar customer_id nullable (pra ON DELETE SET NULL funcionar) ───
ALTER TABLE public.orders
  ALTER COLUMN customer_id DROP NOT NULL;

-- ─── 4. Trocar FK: ON DELETE CASCADE → ON DELETE SET NULL ───
DO $$
DECLARE
  v_constraint_name TEXT;
BEGIN
  SELECT conname INTO v_constraint_name
  FROM pg_constraint
  WHERE conrelid = 'public.orders'::regclass
    AND contype = 'f'
    AND conkey = ARRAY[(
      SELECT attnum FROM pg_attribute
      WHERE attrelid = 'public.orders'::regclass AND attname = 'customer_id'
    )::smallint]
    AND confrelid = 'public.customers'::regclass;

  IF v_constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.orders DROP CONSTRAINT %I', v_constraint_name);
  END IF;
END;
$$;

ALTER TABLE public.orders
  ADD CONSTRAINT orders_customer_id_fkey
  FOREIGN KEY (customer_id)
  REFERENCES public.customers(id)
  ON DELETE SET NULL;

-- ─── 5. Trigger: preencher snapshots no INSERT ───
CREATE OR REPLACE FUNCTION public.set_order_customer_snapshot()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.customer_id IS NOT NULL
     AND (NEW.customer_email_snapshot IS NULL OR NEW.customer_name_snapshot IS NULL)
  THEN
    SELECT
      COALESCE(NEW.customer_email_snapshot, c.email),
      COALESCE(NEW.customer_name_snapshot, c.name)
    INTO NEW.customer_email_snapshot, NEW.customer_name_snapshot
    FROM public.customers c
    WHERE c.id = NEW.customer_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_orders_customer_snapshot ON public.orders;
CREATE TRIGGER trg_orders_customer_snapshot
  BEFORE INSERT ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.set_order_customer_snapshot();

-- ─── 6. Atualizar get_tenant_orders pra usar snapshot quando customer foi apagado ───
DROP FUNCTION IF EXISTS public.get_tenant_orders(UUID, TEXT, INTEGER, INTEGER, TEXT, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ);

CREATE OR REPLACE FUNCTION public.get_tenant_orders(
  p_tenant_id UUID,
  p_search TEXT DEFAULT NULL,
  p_page INTEGER DEFAULT 0,
  p_page_size INTEGER DEFAULT 50,
  p_source TEXT DEFAULT NULL,
  p_status TEXT DEFAULT NULL,
  p_product_id TEXT DEFAULT NULL,
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
    COALESCE(c.name, c.email, o.customer_name_snapshot, o.customer_email_snapshot, '') AS customer_name,
    COALESCE(c.email, o.customer_email_snapshot, '') AS customer_email,
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
      OR COALESCE(c.name, o.customer_name_snapshot, '') ILIKE '%' || v_search || '%'
      OR COALESCE(c.email, o.customer_email_snapshot, '') ILIKE '%' || v_search || '%'
      OR COALESCE(p.name, '') ILIKE '%' || v_search || '%'
      OR o.gateway_external_id ILIKE '%' || v_search || '%'
    )
  ORDER BY COALESCE(o.gateway_order_created_at, o.created_at) DESC
  LIMIT v_page_size
  OFFSET v_offset;
END;
$$;
