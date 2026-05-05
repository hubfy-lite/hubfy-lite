-- Add CNPJA enrichment fields + bank fields to sellers
ALTER TABLE sellers
  ADD COLUMN IF NOT EXISTS ncm integer,
  ADD COLUMN IF NOT EXISTS main_activity text,
  ADD COLUMN IF NOT EXISTS bank_code text,
  ADD COLUMN IF NOT EXISTS bank_agency text,
  ADD COLUMN IF NOT EXISTS bank_account text;

COMMENT ON COLUMN sellers.ncm IS 'CNAE code from CNPJA API (mainActivity.id)';
COMMENT ON COLUMN sellers.main_activity IS 'Main business activity description from CNPJA API';
COMMENT ON COLUMN sellers.bank_code IS 'Bank code (e.g. 001 for Banco do Brasil)';
COMMENT ON COLUMN sellers.bank_agency IS 'Bank branch number';
COMMENT ON COLUMN sellers.bank_account IS 'Bank account number';
