-- ============================================================
-- Universal Gateway Architecture — Fase 1
-- Migra gateways de pagamento para tenant_integrations,
-- cria gateway_product_mappings por provider, adiciona
-- idempotência forte e constraint de 1 gateway ativo.
-- ============================================================

-- ─── 1. Credential rules para gateways de pagamento ─────────
INSERT INTO public.integration_credential_rules (provider, required_keys) VALUES
  ('hotmart',  ARRAY['hottok']),
  ('kiwify',   ARRAY['webhook_secret']),
  ('kirvano',  ARRAY['webhook_secret']),
  ('lastlink', ARRAY['webhook_secret'])
ON CONFLICT (provider) DO NOTHING;

-- ─── 2. Converter gateway_events.provider de enum para TEXT ──
-- Isso permite adicionar novos providers sem ALTER TYPE
ALTER TABLE public.gateway_events
  ALTER COLUMN provider TYPE TEXT USING provider::TEXT;

-- Drop do enum legado (se nenhuma outra coluna depende dele)
-- tenant_gateways.provider também usa, mas vamos migrar e dropar
-- essa tabela na fase 2. Por ora, converter lá também.
ALTER TABLE public.tenant_gateways
  ALTER COLUMN provider TYPE TEXT USING provider::TEXT;

DROP TYPE IF EXISTS public.gateway_provider;

-- ─── 3. Migrar tenant_gateways → tenant_integrations ────────
-- Cria rows em tenant_integrations para cada gateway existente
INSERT INTO public.tenant_integrations (
  tenant_id, provider, status,
  credentials_hint,
  last_validated_at,
  created_at, updated_at
)
SELECT
  tg.tenant_id,
  tg.provider,
  CASE WHEN tg.is_active THEN 'active' ELSE 'inactive' END,
  CASE
    WHEN tg.credentials->>'hottok' IS NOT NULL THEN
      jsonb_build_object('hottok', '••••' || right(tg.credentials->>'hottok', 4))
    ELSE '{}'::jsonb
  END,
  tg.updated_at,
  tg.created_at,
  tg.updated_at
FROM public.tenant_gateways tg
ON CONFLICT (tenant_id, provider) DO NOTHING;

-- Cria secrets correspondentes
INSERT INTO public.tenant_integration_secrets (integration_id, credentials, created_at)
SELECT
  ti.id,
  tg.credentials,
  tg.created_at
FROM public.tenant_gateways tg
JOIN public.tenant_integrations ti
  ON ti.tenant_id = tg.tenant_id
  AND ti.provider = tg.provider
ON CONFLICT (integration_id) DO UPDATE
  SET credentials = EXCLUDED.credentials;

-- ─── 4. Índice parcial: 1 gateway de pagamento ativo por tenant
-- O trigger (passo 5) cuida de auto-desativar, mas o índice
-- garante integridade mesmo sob concorrência.
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_active_payment_gateway
  ON public.tenant_integrations (tenant_id)
  WHERE status = 'active'
    AND provider IN ('hotmart', 'kiwify', 'kirvano', 'lastlink');

-- ─── 5. Trigger: auto-desativar gateways ao ativar novo ─────
CREATE OR REPLACE FUNCTION public.enforce_single_active_gateway()
RETURNS TRIGGER AS $$
DECLARE
  payment_providers TEXT[] := ARRAY['hotmart','kiwify','kirvano','lastlink'];
BEGIN
  -- Só aplica para providers de pagamento
  IF NOT (NEW.provider = ANY(payment_providers)) THEN
    RETURN NEW;
  END IF;

  -- Se está ativando, desativa os outros gateways do tenant
  IF NEW.status = 'active' THEN
    UPDATE public.tenant_integrations
    SET status = 'inactive', updated_at = now()
    WHERE tenant_id = NEW.tenant_id
      AND provider = ANY(payment_providers)
      AND id != NEW.id
      AND status = 'active';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_enforce_single_active_gateway
  BEFORE INSERT OR UPDATE OF status ON public.tenant_integrations
  FOR EACH ROW EXECUTE FUNCTION public.enforce_single_active_gateway();

-- ─── 6. Recriar gateway_product_mappings (por integração) ───
-- A tabela original foi dropada em 20260228020000.
-- Agora referencia tenant_integrations ao invés de tenant_gateways.
CREATE TABLE public.gateway_product_mappings (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  integration_id        UUID NOT NULL REFERENCES public.tenant_integrations(id) ON DELETE CASCADE,
  provider              TEXT NOT NULL,  -- denormalizado de tenant_integrations.provider
  external_product_id   TEXT NOT NULL,
  product_id            UUID REFERENCES public.products(id) ON DELETE SET NULL,
  external_product_name TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (integration_id, external_product_id)
);

CREATE INDEX idx_gpm_lookup
  ON public.gateway_product_mappings (tenant_id, provider, external_product_id);

CREATE INDEX idx_gpm_integration
  ON public.gateway_product_mappings (integration_id);

-- RLS
ALTER TABLE public.gateway_product_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "gpm_editor_select" ON public.gateway_product_mappings
  FOR SELECT USING (public.is_tenant_editor(tenant_id) OR public.is_admin());

CREATE POLICY "gpm_editor_insert" ON public.gateway_product_mappings
  FOR INSERT WITH CHECK (public.is_tenant_editor(tenant_id) OR public.is_admin());

CREATE POLICY "gpm_editor_update" ON public.gateway_product_mappings
  FOR UPDATE USING (public.is_tenant_editor(tenant_id) OR public.is_admin());

CREATE POLICY "gpm_editor_delete" ON public.gateway_product_mappings
  FOR DELETE USING (public.is_tenant_editor(tenant_id) OR public.is_admin());

CREATE POLICY "gpm_service_role" ON public.gateway_product_mappings
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Backfill: migrar products.gateway_product_ids → gateway_product_mappings
-- Usa DISTINCT ON para skip duplicatas (mesmo external_id em múltiplos produtos)
INSERT INTO public.gateway_product_mappings (
  tenant_id, integration_id, provider, external_product_id, product_id
)
SELECT DISTINCT ON (ti.id, ext_id)
  p.tenant_id,
  ti.id,
  'hotmart',
  ext_id,
  p.id
FROM public.products p
CROSS JOIN LATERAL unnest(p.gateway_product_ids) AS ext_id
JOIN public.tenant_integrations ti
  ON ti.tenant_id = p.tenant_id
  AND ti.provider = 'hotmart'
WHERE p.gateway_product_ids IS NOT NULL
  AND array_length(p.gateway_product_ids, 1) > 0
ON CONFLICT (integration_id, external_product_id) DO NOTHING;

-- ─── 7. Expandir orders ─────────────────────────────────────
-- gateway_provider: de qual gateway veio (TEXT, extensível)
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS gateway_provider TEXT;

-- integration_id: qual conexão criou a order (FK para rastreabilidade)
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS integration_id UUID REFERENCES public.tenant_integrations(id);

-- Backfill orders existentes de gateway externo
UPDATE public.orders
SET gateway_provider = 'hotmart'
WHERE source = 'external_gateway'
  AND gateway_provider IS NULL;

UPDATE public.orders o
SET integration_id = ti.id
FROM public.tenant_integrations ti
WHERE ti.tenant_id = o.tenant_id
  AND ti.provider = 'hotmart'
  AND o.source = 'external_gateway'
  AND o.integration_id IS NULL;

-- Deduplicate orders antes de criar índice de idempotência.
-- Mantém a order mais recente (por created_at) para cada combinação.
DELETE FROM public.orders o
USING (
  SELECT id, ROW_NUMBER() OVER (
    PARTITION BY tenant_id, gateway_provider, gateway_external_id
    ORDER BY created_at DESC
  ) AS rn
  FROM public.orders
  WHERE gateway_external_id IS NOT NULL
) ranked
WHERE o.id = ranked.id AND ranked.rn > 1;

-- Idempotência forte: UNIQUE parcial impede orders duplicadas
-- mesmo sob concorrência de webhooks
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_gateway_idempotency
  ON public.orders (tenant_id, gateway_provider, gateway_external_id)
  WHERE gateway_external_id IS NOT NULL;

-- ─── 8. Expandir gateway_events ─────────────────────────────
-- integration_id referencia tenant_integrations (novo sistema)
ALTER TABLE public.gateway_events
  ADD COLUMN IF NOT EXISTS integration_id UUID REFERENCES public.tenant_integrations(id);

-- Backfill: associar events antigos à integração correspondente
UPDATE public.gateway_events ge
SET integration_id = ti.id
FROM public.tenant_gateways tg
JOIN public.tenant_integrations ti
  ON ti.tenant_id = tg.tenant_id
  AND ti.provider = tg.provider
WHERE ge.gateway_id = tg.id
  AND ge.integration_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_gateway_events_integration
  ON public.gateway_events (integration_id);

-- ─── 9. Atualizar get_tenant_orders para incluir gateway_provider ─
-- (O RPC retorna dados para a UI de orders)
DROP FUNCTION IF EXISTS public.get_tenant_orders(UUID, TEXT, INTEGER, INTEGER);

CREATE OR REPLACE FUNCTION public.get_tenant_orders(
  p_tenant_id UUID,
  p_search TEXT DEFAULT NULL,
  p_page INTEGER DEFAULT 0,
  p_page_size INTEGER DEFAULT 50
)
RETURNS TABLE (
  id UUID,
  public_id TEXT,
  tenant_id UUID,
  customer_id UUID,
  product_id UUID,
  checkout_id UUID,
  price_id UUID,
  order_number INTEGER,
  type order_type,
  status order_status,
  unit_amount INTEGER,
  currency TEXT,
  is_order_bump BOOLEAN,
  parent_gateway_external_id TEXT,
  gateway_external_id TEXT,
  gateway_provider TEXT,
  gateway_order_created_at TIMESTAMPTZ,
  effective_order_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  customer_name TEXT,
  customer_email TEXT,
  product_name TEXT,
  product_benefit TEXT,
  total_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_page_size INTEGER := LEAST(GREATEST(p_page_size, 1), 100);
  v_offset INTEGER := GREATEST(p_page, 0) * v_page_size;
  v_search TEXT := NULLIF(TRIM(p_search), '');
  v_search_int INTEGER;
BEGIN
  IF NOT public.is_tenant_editor(p_tenant_id) AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF v_search IS NOT NULL THEN
    BEGIN
      v_search_int := v_search::INTEGER;
    EXCEPTION WHEN OTHERS THEN
      v_search_int := NULL;
    END;
  END IF;

  RETURN QUERY
  SELECT
    o.id,
    o.public_id,
    o.tenant_id,
    o.customer_id,
    o.product_id,
    o.checkout_id,
    o.price_id,
    o.order_number,
    o.type,
    o.status,
    o.unit_amount,
    o.currency,
    COALESCE(o.is_order_bump, false),
    o.parent_gateway_external_id,
    o.gateway_external_id,
    o.gateway_provider,
    o.gateway_order_created_at,
    COALESCE(o.gateway_order_created_at, o.created_at) AS effective_order_at,
    o.created_at,
    o.updated_at,
    COALESCE(c.name, c.email, '') AS customer_name,
    COALESCE(c.email, '') AS customer_email,
    COALESCE(p.name, '') AS product_name,
    p.benefit AS product_benefit,
    COUNT(*) OVER() AS total_count
  FROM orders o
  LEFT JOIN customers c ON c.id = o.customer_id
  LEFT JOIN products p ON p.id = o.product_id
  WHERE o.tenant_id = p_tenant_id
    AND (
      v_search IS NULL
      OR (v_search_int IS NOT NULL AND o.order_number = v_search_int)
      OR COALESCE(c.name, '') ILIKE '%' || v_search || '%'
      OR c.email ILIKE '%' || v_search || '%'
      OR COALESCE(p.name, '') ILIKE '%' || v_search || '%'
      OR o.gateway_external_id ILIKE '%' || v_search || '%'
    )
  ORDER BY COALESCE(o.gateway_order_created_at, o.created_at) DESC
  LIMIT v_page_size
  OFFSET v_offset;
END;
$$;

-- ============================================================
-- NOTA: tenant_gateways, gateway_events.gateway_id e
-- products.gateway_product_ids NÃO são removidos nesta etapa.
-- A remoção será feita na Migration Etapa 2 após validação.
-- ============================================================
