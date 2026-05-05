-- ============================================================
-- Fix: merge de credenciais parciais ao atualizar integração
--
-- Problema:
--   Ao atualizar apenas um campo (ex: basic_auth), o frontend
--   envia só { basic_auth: "..." }. O INSERT ... ON CONFLICT
--   dispara o trigger BEFORE INSERT com payload parcial, e o
--   trigger rejeita por falta de hottok — antes do ON CONFLICT
--   DO UPDATE ter chance de fazer merge.
--
-- Fix (duas partes):
--   1. Trigger: no INSERT, validar credenciais efetivas
--      (existing || NEW) ao invés de só NEW.
--   2. RPC: manter ON CONFLICT com || para a gravação real.
-- ============================================================


-- ─────────────────────────────────────────────────────────────
-- 1. TRIGGER: validar credenciais efetivas (existing || NEW)
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.validate_integration_credentials()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
DECLARE
  v_provider  TEXT;
  v_required  TEXT[];
  v_key       TEXT;
  v_existing  JSONB;
  v_effective JSONB;
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
    -- On INSERT path (upsert): merge with existing credentials so that
    -- partial updates don't fail validation. On UPDATE, NEW.credentials
    -- already comes merged from ON CONFLICT, so use it directly.
    IF TG_OP = 'INSERT' THEN
      SELECT s.credentials INTO v_existing
      FROM public.tenant_integration_secrets s
      WHERE s.integration_id = NEW.integration_id;

      v_effective := COALESCE(v_existing, '{}'::jsonb) || NEW.credentials;
    ELSE
      v_effective := NEW.credentials;
    END IF;

    FOREACH v_key IN ARRAY v_required LOOP
      IF NOT (v_effective ? v_key) THEN
        RAISE EXCEPTION 'Credencial "%" obrigatoria para provider "%"', v_key, v_provider;
      END IF;
      IF BTRIM(v_effective->>v_key) = '' THEN
        RAISE EXCEPTION 'Credencial "%" nao pode ser vazia para provider "%"', v_key, v_provider;
      END IF;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;


-- ─────────────────────────────────────────────────────────────
-- 2. RPC: ON CONFLICT com merge para gravação real
-- ─────────────────────────────────────────────────────────────

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
    credentials_hint    = COALESCE(tenant_integrations.credentials_hint, '{}'::jsonb) || EXCLUDED.credentials_hint,
    last_validated_at   = now(),
    last_error          = NULL
  RETURNING * INTO v_integration;

  -- Upsert secret — merge para preservar chaves existentes
  INSERT INTO public.tenant_integration_secrets (integration_id, credentials)
  VALUES (v_integration.id, p_credentials)
  ON CONFLICT (integration_id) DO UPDATE
    SET credentials = tenant_integration_secrets.credentials || EXCLUDED.credentials;

  RETURN NEXT v_integration;
END;
$$;
