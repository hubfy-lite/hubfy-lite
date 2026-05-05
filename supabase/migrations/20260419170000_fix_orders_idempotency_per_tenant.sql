-- ============================================================
-- Migration: Orders idempotency index scoped per tenant
--
-- The original index (20260221000000) was UNIQUE (idempotency_key) globally,
-- which means two tenants cannot share the same client-generated key — the
-- second tenant hits a 23505 from the DB and the handler's replay re-query
-- (scoped per tenant) returns nothing, surfacing as a 500.
--
-- Scope the uniqueness per tenant, matching how the handler validates and
-- replays idempotent requests in supabase/functions/api/routes/orders.ts.
-- ============================================================

DROP INDEX IF EXISTS public.idx_orders_idempotency_key;

CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_tenant_idempotency_key
  ON public.orders (tenant_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

COMMENT ON INDEX public.idx_orders_tenant_idempotency_key IS
  'Idempotency guard for order creation — scoped per tenant. Replaces the legacy global index from 20260221000000.';
