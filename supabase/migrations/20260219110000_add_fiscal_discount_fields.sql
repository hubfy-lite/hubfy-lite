-- Add collect_fiscal_id and allow_discount_codes to checkouts table
ALTER TABLE checkouts
  ADD COLUMN IF NOT EXISTS collect_fiscal_id boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS allow_discount_codes boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN checkouts.collect_fiscal_id IS 'Whether to collect CPF/CNPJ (fiscal ID) from the customer';
COMMENT ON COLUMN checkouts.allow_discount_codes IS 'Whether to allow discount/coupon codes on this checkout';
