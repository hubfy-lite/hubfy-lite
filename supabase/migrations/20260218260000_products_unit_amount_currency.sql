-- ============================================================
-- Migration: Rename products.price → unit_amount + add currency
--
-- Standardizes products table to match Stripe naming:
-- - price → unit_amount (in minor currency units / cents)
-- - adds currency column with CHECK constraint (USD, BRL)
-- ============================================================

-- 1. Rename price → unit_amount
ALTER TABLE public.products RENAME COLUMN price TO unit_amount;

-- 2. Add currency column
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'BRL';

-- 3. Add CHECK constraint
ALTER TABLE public.products
  ADD CONSTRAINT chk_products_currency
  CHECK (currency IN ('USD', 'BRL'));

-- 4. Update comments
COMMENT ON COLUMN public.products.unit_amount IS 'Reference price in minor currency units (cents). Stripe-aligned naming.';
COMMENT ON COLUMN public.products.currency IS 'ISO 4217 currency code. Constrained to USD, BRL.';
