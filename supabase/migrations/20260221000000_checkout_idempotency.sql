-- ============================================================
-- Migration: Checkout Idempotency
--
-- Adds idempotency_key to orders table to prevent duplicate
-- orders from double-clicks or retried submissions.
-- The key is generated client-side (UUID) and validated
-- server-side in the process-checkout edge function.
-- ============================================================

-- 1. Add idempotency_key column (nullable for existing orders)
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

-- 2. Unique constraint — prevents duplicate orders from the same submission
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_idempotency_key
  ON public.orders(idempotency_key)
  WHERE idempotency_key IS NOT NULL;
