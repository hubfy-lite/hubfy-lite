-- Add identity fields from gateway payload to customers
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS first_name text,
  ADD COLUMN IF NOT EXISTS last_name text,
  ADD COLUMN IF NOT EXISTS document text,
  ADD COLUMN IF NOT EXISTS document_type text;

COMMENT ON COLUMN public.customers.first_name IS 'Customer first name (ex: buyer.first_name)';
COMMENT ON COLUMN public.customers.last_name IS 'Customer last name (ex: buyer.last_name)';
COMMENT ON COLUMN public.customers.document IS 'Customer fiscal document (ex: CPF/CNPJ)';
COMMENT ON COLUMN public.customers.document_type IS 'Customer fiscal document type (ex: CPF, CNPJ)';
