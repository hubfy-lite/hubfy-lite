-- ============================================================
-- Add import_type to customer_import_batches
-- Distinguishes 'customers' (with product binding) from
-- 'contacts' (no products). Default 'customers' for existing rows.
-- ============================================================

ALTER TABLE public.customer_import_batches
  ADD COLUMN IF NOT EXISTS import_type TEXT NOT NULL DEFAULT 'customers';
