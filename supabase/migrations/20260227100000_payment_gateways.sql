-- ============================================================
-- Payment Gateways — V1 (Hotmart)
-- Arquitetura genérica para múltiplos provedores
-- ============================================================

-- ─── Enum de provedores ───────────────────────────────────────
CREATE TYPE public.gateway_provider AS ENUM ('hotmart');
-- Futuros: 'kiwify', 'lastlink', 'pagarme', 'mercadopago', 'stripe'

-- ─── 1. tenant_gateways ──────────────────────────────────────
-- 1 gateway ativo por tenant; demais ficam inativos
CREATE TABLE public.tenant_gateways (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  provider      public.gateway_provider NOT NULL,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  credentials   JSONB NOT NULL DEFAULT '{}',  -- { "hottok": "xxx" }
  webhook_url   TEXT,                          -- URL copiada para o painel do provedor
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Garantia: no máximo 1 gateway ativo por tenant
CREATE UNIQUE INDEX uq_tenant_gateways_active
  ON public.tenant_gateways(tenant_id)
  WHERE is_active = true;

CREATE INDEX idx_tenant_gateways_tenant ON public.tenant_gateways(tenant_id);

-- ─── 2. gateway_offer_mappings ───────────────────────────────
-- 1 oferta externa → N produtos Hubfy (suporta order bump)
CREATE TABLE public.gateway_offer_mappings (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  gateway_id          UUID NOT NULL REFERENCES public.tenant_gateways(id) ON DELETE CASCADE,
  external_offer_id   TEXT NOT NULL,          -- código da oferta no provedor
  external_offer_name TEXT,                   -- nome para exibição no admin
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(gateway_id, external_offer_id)
);

CREATE INDEX idx_gateway_offer_mappings_gateway ON public.gateway_offer_mappings(gateway_id);
CREATE INDEX idx_gateway_offer_mappings_tenant  ON public.gateway_offer_mappings(tenant_id);

-- ─── 3. gateway_offer_products ───────────────────────────────
-- Tabela junction: 1 oferta → N produtos Hubfy
CREATE TABLE public.gateway_offer_products (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mapping_id  UUID NOT NULL REFERENCES public.gateway_offer_mappings(id) ON DELETE CASCADE,
  product_id  UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(mapping_id, product_id)
);

CREATE INDEX idx_gateway_offer_products_mapping ON public.gateway_offer_products(mapping_id);
CREATE INDEX idx_gateway_offer_products_product ON public.gateway_offer_products(product_id);

-- ─── 4. gateway_events ─────────────────────────────────
-- Log imutável de TODOS os webhooks recebidos (antes do processamento)
CREATE TABLE public.gateway_events (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID REFERENCES public.tenants(id) ON DELETE SET NULL,
  gateway_id          UUID REFERENCES public.tenant_gateways(id) ON DELETE SET NULL,
  provider            public.gateway_provider NOT NULL,

  -- Dados do evento (normalizados)
  event_type          TEXT,            -- 'purchase_approved', 'purchase_refunded', etc.
  external_event_type TEXT,            -- tipo original do provedor: 'PURCHASE_APPROVED'
  external_order_id   TEXT,            -- ID do pedido no provedor (idempotência)
  external_offer_id   TEXT,            -- ID da oferta no provedor
  buyer_email         TEXT,            -- para busca rápida no admin

  -- Payload bruto para debug
  raw_payload         JSONB NOT NULL DEFAULT '{}',

  -- Resultado do processamento
  status              TEXT NOT NULL DEFAULT 'received'
                      CHECK (status IN ('received','processing','processed','failed','ignored','duplicate','unauthorized','invalid_payload')),
  error_message       TEXT,
  result              JSONB,           -- { customer_id, order_ids: [...], actions: [...] }

  -- Retry
  retry_count         INTEGER NOT NULL DEFAULT 0,
  next_retry_at       TIMESTAMPTZ,

  -- Timestamps
  processed_at        TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_gwl_tenant        ON public.gateway_events(tenant_id, created_at DESC);
CREATE INDEX idx_gwl_status        ON public.gateway_events(status) WHERE status IN ('received','failed');
CREATE INDEX idx_gwl_external_order ON public.gateway_events(external_order_id) WHERE external_order_id IS NOT NULL;
CREATE INDEX idx_gwl_buyer_email   ON public.gateway_events(buyer_email) WHERE buyer_email IS NOT NULL;

-- ─── 5. orders: campo gateway_external_id ────────────────────
-- Chave de idempotência para webhooks de gateways externos
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS gateway_external_id TEXT;

COMMENT ON COLUMN public.orders.gateway_external_id IS
  'ID do pedido no gateway externo (ex: Hotmart order_id). Usado como idempotency key para webhooks.';

CREATE INDEX IF NOT EXISTS idx_orders_gateway_external_id
  ON public.orders(gateway_external_id)
  WHERE gateway_external_id IS NOT NULL;

-- ─── 6. Triggers updated_at ──────────────────────────────────
CREATE TRIGGER handle_updated_at_tenant_gateways
  BEFORE UPDATE ON public.tenant_gateways
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER handle_updated_at_gateway_offer_mappings
  BEFORE UPDATE ON public.gateway_offer_mappings
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ─── 7. RLS ──────────────────────────────────────────────────

-- tenant_gateways
ALTER TABLE public.tenant_gateways ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_gateways: owner/editor CRUD"
  ON public.tenant_gateways
  USING (public.is_tenant_editor(tenant_id) OR public.is_admin())
  WITH CHECK (public.is_tenant_editor(tenant_id) OR public.is_admin());

-- gateway_offer_mappings
ALTER TABLE public.gateway_offer_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "gateway_offer_mappings: owner/editor CRUD"
  ON public.gateway_offer_mappings
  USING (public.is_tenant_editor(tenant_id) OR public.is_admin())
  WITH CHECK (public.is_tenant_editor(tenant_id) OR public.is_admin());

-- gateway_offer_products (sem tenant_id, acesso via mapping)
ALTER TABLE public.gateway_offer_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "gateway_offer_products: owner/editor CRUD"
  ON public.gateway_offer_products
  USING (
    EXISTS (
      SELECT 1 FROM public.gateway_offer_mappings m
      WHERE m.id = mapping_id
        AND (public.is_tenant_editor(m.tenant_id) OR public.is_admin())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.gateway_offer_mappings m
      WHERE m.id = mapping_id
        AND (public.is_tenant_editor(m.tenant_id) OR public.is_admin())
    )
  );

-- gateway_events: somente leitura para owner/editor
ALTER TABLE public.gateway_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "gateway_events: owner/editor SELECT"
  ON public.gateway_events FOR SELECT
  USING (public.is_tenant_editor(tenant_id) OR public.is_admin());

-- Sem INSERT/UPDATE policy: apenas edge functions (service role) escrevem nos logs
