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
