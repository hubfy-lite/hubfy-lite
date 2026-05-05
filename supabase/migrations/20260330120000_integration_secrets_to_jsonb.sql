-- Migrate tenant_integration_secrets from a single access_token TEXT column
-- to a flexible credentials JSONB column (supports multiple keys per provider).
-- Existing Vimeo tokens are preserved as {"access_token": "..."}.

-- 1. Add credentials JSONB column
ALTER TABLE public.tenant_integration_secrets
  ADD COLUMN IF NOT EXISTS credentials JSONB NOT NULL DEFAULT '{}'::jsonb;

-- 2. Migrate existing access_token values into credentials
UPDATE public.tenant_integration_secrets
SET credentials = jsonb_build_object('access_token', access_token)
WHERE access_token IS NOT NULL
  AND credentials = '{}'::jsonb;

-- 3. Add updated_at column
ALTER TABLE public.tenant_integration_secrets
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

CREATE TRIGGER set_tenant_integration_secrets_updated_at
  BEFORE UPDATE ON public.tenant_integration_secrets
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 4. Add credentials_hint JSONB to tenant_integrations (public, masked values)
ALTER TABLE public.tenant_integrations
  ADD COLUMN IF NOT EXISTS credentials_hint JSONB DEFAULT '{}'::jsonb;

-- 5. Backfill hints for existing Vimeo integrations
UPDATE public.tenant_integrations ti
SET credentials_hint = jsonb_build_object(
  'access_token',
  CASE
    WHEN length(s.access_token) > 4
    THEN '••••' || right(s.access_token, 4)
    ELSE '••••'
  END
)
FROM public.tenant_integration_secrets s
JOIN public.tenant_integrations ti2 ON ti2.id = s.integration_id
WHERE ti.id = ti2.id
  AND s.access_token IS NOT NULL;

-- 6. Drop the old column
ALTER TABLE public.tenant_integration_secrets
  DROP COLUMN access_token;
