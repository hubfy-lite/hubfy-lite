-- Add email_sender_name to tenants for configurable email "From" name
-- Defaults to NULL → falls back to tenant.name at send time
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS email_sender_name TEXT;

COMMENT ON COLUMN public.tenants.email_sender_name IS
  'Custom sender name for transactional emails. Falls back to tenant name if NULL.';
