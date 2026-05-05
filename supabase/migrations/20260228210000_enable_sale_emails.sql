-- Add toggle to control whether sale notification emails are sent
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS enable_sale_emails BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN public.tenants.enable_sale_emails
  IS 'When true, delivery emails are automatically sent to customers after each approved sale.';
