-- ═══════════════════════════════════════════════════════════════════════
-- Integration robustness: transactional connect RPC + credential validation
--
-- This migration adds:
--   1. integration_credential_rules — required keys per provider
--   2. validate_integration_credentials() trigger — blocks invalid secrets
--   3. connect_integration() RPC — atomic upsert of integration + secret
-- ═══════════════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════════════
-- 1. CREDENTIAL RULES TABLE
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.integration_credential_rules (
  provider     TEXT PRIMARY KEY,
  required_keys TEXT[] NOT NULL
);

COMMENT ON TABLE public.integration_credential_rules IS
  'Required credential keys per integration provider. Used by trigger to validate secrets before save.';

-- Seed with current providers
INSERT INTO public.integration_credential_rules (provider, required_keys) VALUES
  ('vimeo',           ARRAY['access_token']),
  ('openai',          ARRAY['api_key']),
  ('anthropic',       ARRAY['api_key'])
ON CONFLICT (provider) DO NOTHING;

-- RLS: read-only for authenticated, no writes from client
ALTER TABLE public.integration_credential_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated can read credential rules"
  ON public.integration_credential_rules FOR SELECT
  TO authenticated
  USING (true);

-- ═══════════════════════════════════════════════════════════════════════
-- 2. CREDENTIAL VALIDATION TRIGGER
-- ═══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.validate_integration_credentials()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
DECLARE
  v_provider TEXT;
  v_required TEXT[];
  v_key      TEXT;
BEGIN
  -- Look up the provider from the parent integration
  SELECT ti.provider INTO v_provider
  FROM public.tenant_integrations ti
  WHERE ti.id = NEW.integration_id;

  IF v_provider IS NULL THEN
    RAISE EXCEPTION 'integration_id "%" not found in tenant_integrations', NEW.integration_id;
  END IF;

  -- Look up required keys for this provider
  SELECT required_keys INTO v_required
  FROM public.integration_credential_rules
  WHERE provider = v_provider;

  -- If provider has no rules registered, accept (flexibility for new providers)
  IF v_required IS NOT NULL THEN
    FOREACH v_key IN ARRAY v_required LOOP
      IF NOT (NEW.credentials ? v_key) THEN
        RAISE EXCEPTION 'Credencial "%" obrigatoria para provider "%"', v_key, v_provider;
      END IF;
      IF BTRIM(NEW.credentials->>v_key) = '' THEN
        RAISE EXCEPTION 'Credencial "%" nao pode ser vazia para provider "%"', v_key, v_provider;
      END IF;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_integration_credentials
  BEFORE INSERT OR UPDATE ON public.tenant_integration_secrets
  FOR EACH ROW EXECUTE FUNCTION public.validate_integration_credentials();

-- ═══════════════════════════════════════════════════════════════════════
-- 3. TRANSACTIONAL CONNECT RPC
-- ═══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.connect_integration(
  p_tenant_id        UUID,
  p_provider         TEXT,
  p_metadata         JSONB DEFAULT '{}'::jsonb,
  p_credentials      JSONB DEFAULT '{}'::jsonb,
  p_credentials_hint JSONB DEFAULT '{}'::jsonb
)
RETURNS SETOF public.tenant_integrations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_integration public.tenant_integrations;
BEGIN
  -- Upsert integration (public metadata)
  INSERT INTO public.tenant_integrations (
    tenant_id,
    provider,
    status,
    account_name,
    account_url,
    avatar_url,
    account_external_id,
    credentials_hint,
    last_validated_at,
    last_error
  ) VALUES (
    p_tenant_id,
    p_provider,
    'active',
    p_metadata->>'account_name',
    p_metadata->>'account_url',
    p_metadata->>'avatar_url',
    p_metadata->>'account_external_id',
    p_credentials_hint,
    now(),
    NULL
  )
  ON CONFLICT (tenant_id, provider) DO UPDATE SET
    status              = 'active',
    account_name        = EXCLUDED.account_name,
    account_url         = EXCLUDED.account_url,
    avatar_url          = EXCLUDED.avatar_url,
    account_external_id = EXCLUDED.account_external_id,
    credentials_hint    = EXCLUDED.credentials_hint,
    last_validated_at   = now(),
    last_error          = NULL
  RETURNING * INTO v_integration;

  -- Upsert secret (same transaction — if this fails, integration upsert rolls back too)
  INSERT INTO public.tenant_integration_secrets (integration_id, credentials)
  VALUES (v_integration.id, p_credentials)
  ON CONFLICT (integration_id) DO UPDATE
    SET credentials = EXCLUDED.credentials;

  RETURN NEXT v_integration;
END;
$$;

COMMENT ON FUNCTION public.connect_integration IS
  'Atomic upsert of tenant integration + secret. Called by edge functions after validating credentials with the external provider API.';

-- Lock down: only service_role can call this RPC (edge functions only, no browser bypass)
REVOKE EXECUTE ON FUNCTION public.connect_integration(uuid, text, jsonb, jsonb, jsonb)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.connect_integration(uuid, text, jsonb, jsonb, jsonb)
  TO service_role;

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
