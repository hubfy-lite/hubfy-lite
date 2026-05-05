-- ============================================================
-- Migration: Promote effective_order_at to a real column
--
-- Across the product (admin lists, metrics, gateway handlers), the canonical
-- "order date" is COALESCE(gateway_order_created_at, created_at) — the index
-- in 20260313090000_effective_order_date.sql already materialises this
-- expression. The public REST API, however, has been ordering and filtering
-- by created_at, which silently breaks for orders imported via POST /v1/orders
-- with a historical effective_order_at.
--
-- Add a GENERATED column so Supabase-js can order/filter on it directly,
-- without raw SQL fragments.
-- ============================================================

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS effective_order_at TIMESTAMPTZ
    GENERATED ALWAYS AS (COALESCE(gateway_order_created_at, created_at)) STORED;

COMMENT ON COLUMN public.orders.effective_order_at IS
  'Canonical order date — gateway_order_created_at when present, otherwise created_at. Generated column, kept in sync automatically.';

-- Index for list/filter queries from the public API
CREATE INDEX IF NOT EXISTS idx_orders_tenant_effective_order_at_col
  ON public.orders (tenant_id, effective_order_at DESC, id DESC);
