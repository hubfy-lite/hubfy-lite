-- ═══════════════════════════════════════════════════════
-- API Keys: chaves de acesso programático por workspace
-- ═══════════════════════════════════════════════════════

CREATE TABLE public.api_keys (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  created_by   UUID NOT NULL REFERENCES auth.users(id),
  label        TEXT NOT NULL DEFAULT '',
  key_prefix   TEXT NOT NULL,          -- "sk_live_" + primeiros 8 hex (para identificar)
  key_hash     TEXT NOT NULL UNIQUE,   -- SHA-256 hex da key completa
  last_used_at TIMESTAMPTZ,
  revoked_at   TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.api_keys IS 'API keys para acesso programático ao workspace. A key completa nunca é armazenada — apenas o hash SHA-256.';
COMMENT ON COLUMN public.api_keys.key_prefix IS 'Prefixo visível (sk_live_ + 8 chars) para o owner identificar a key na UI.';
COMMENT ON COLUMN public.api_keys.key_hash IS 'SHA-256 hex da key completa. Usado para validação.';

-- Índices
CREATE INDEX idx_api_keys_hash ON public.api_keys(key_hash) WHERE revoked_at IS NULL;
CREATE INDEX idx_api_keys_tenant ON public.api_keys(tenant_id) WHERE revoked_at IS NULL;

-- ── RLS ──────────────────────────────────────────────
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

-- Owners podem ver keys do seu workspace
CREATE POLICY "Owners can view api_keys"
  ON public.api_keys FOR SELECT
  USING (public.is_tenant_owner(tenant_id));

-- Owners podem criar keys
CREATE POLICY "Owners can create api_keys"
  ON public.api_keys FOR INSERT
  WITH CHECK (public.is_tenant_owner(tenant_id) AND created_by = auth.uid());

-- Owners podem revogar (update revoked_at)
CREATE POLICY "Owners can revoke api_keys"
  ON public.api_keys FOR UPDATE
  USING (public.is_tenant_owner(tenant_id))
  WITH CHECK (public.is_tenant_owner(tenant_id));

-- Ninguém deleta — apenas revoga (soft delete)
-- Sem policy de DELETE = bloqueado por RLS

-- ── RPC: validar API key ─────────────────────────────
CREATE OR REPLACE FUNCTION public.validate_api_key(p_key_hash TEXT)
RETURNS TABLE(tenant_id UUID, user_id UUID, key_id UUID)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  UPDATE public.api_keys ak
  SET last_used_at = now()
  WHERE ak.key_hash = p_key_hash
    AND ak.revoked_at IS NULL
  RETURNING ak.tenant_id, ak.created_by, ak.id;
END;
$$;

COMMENT ON FUNCTION public.validate_api_key IS 'Valida uma API key pelo hash SHA-256. Retorna tenant_id + user_id se válida. Atualiza last_used_at.';
