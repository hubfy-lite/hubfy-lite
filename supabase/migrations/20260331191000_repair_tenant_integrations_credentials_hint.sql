-- Repair schema drift for projects where tenant_integrations exists
-- without the credentials_hint column expected by integration functions.

ALTER TABLE public.tenant_integrations
  ADD COLUMN IF NOT EXISTS credentials_hint JSONB DEFAULT '{}'::jsonb;

NOTIFY pgrst, 'reload schema';
