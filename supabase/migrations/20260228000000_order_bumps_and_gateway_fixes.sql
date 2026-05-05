-- =====================================================================
-- Migration: Order Bumps + Chargeback enum + Gateway Product Mappings
-- Substitui gateway_offer_mappings + gateway_offer_products pelo
-- novo modelo de mapeamento por produto (1:1, Hotmart ID → Hubfy UUID)
-- =====================================================================

-- 1. Adiciona valor 'chargeback' ao enum order_status (idempotente)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumtypid = 'public.order_status'::regtype
      AND enumlabel = 'chargeback'
  ) THEN
    ALTER TYPE public.order_status ADD VALUE 'chargeback';
  END IF;
END;
$$;

-- 2. Tabela de order bumps (produtos adicionais por pedido)
CREATE TABLE IF NOT EXISTS public.order_bump_items (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id    uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id  uuid NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (order_id, product_id)
);

ALTER TABLE public.order_bump_items ENABLE ROW LEVEL SECURITY;

-- RLS: leitura para membros autenticados do tenant (via orders → tenant_id)
CREATE POLICY "order_bump_items_select" ON public.order_bump_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_id
        AND o.tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid() LIMIT 1)
    )
  );

-- RLS: escrita apenas para admins/editores do tenant
CREATE POLICY "order_bump_items_insert" ON public.order_bump_items
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_id
        AND is_tenant_editor(o.tenant_id)
    )
  );

CREATE POLICY "order_bump_items_delete" ON public.order_bump_items
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_id
        AND is_tenant_editor(o.tenant_id)
    )
  );

-- Service role tem acesso total (edge functions)
CREATE POLICY "order_bump_items_service_role" ON public.order_bump_items
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- 3. Tabela de mapeamento produto-por-produto (gateway → Hubfy)
--    Um registro por produto importado do gateway.
--    product_id é nullable: ainda não vinculado ao produto Hubfy.
CREATE TABLE IF NOT EXISTS public.gateway_product_mappings (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  gateway_id              uuid NOT NULL REFERENCES public.tenant_gateways(id) ON DELETE CASCADE,
  -- ID do produto no gateway externo (ex: Hotmart)
  external_product_id     text NOT NULL,
  -- Nome e thumbnail vindos do gateway (sincronizados)
  external_product_name   text,
  external_product_thumb  text,
  -- Produto Hubfy correspondente (nullable até o usuário vincular)
  product_id              uuid REFERENCES public.products(id) ON DELETE SET NULL,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),
  UNIQUE (gateway_id, external_product_id)
);

ALTER TABLE public.gateway_product_mappings ENABLE ROW LEVEL SECURITY;

-- Trigger para updated_at
CREATE TRIGGER gateway_product_mappings_updated_at
  BEFORE UPDATE ON public.gateway_product_mappings
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- RLS: leitura para editores do tenant
CREATE POLICY "gpm_select" ON public.gateway_product_mappings
  FOR SELECT USING (is_tenant_editor(tenant_id));

-- RLS: escrita para editores do tenant
CREATE POLICY "gpm_insert" ON public.gateway_product_mappings
  FOR INSERT WITH CHECK (is_tenant_editor(tenant_id));

CREATE POLICY "gpm_update" ON public.gateway_product_mappings
  FOR UPDATE USING (is_tenant_editor(tenant_id));

CREATE POLICY "gpm_delete" ON public.gateway_product_mappings
  FOR DELETE USING (is_tenant_editor(tenant_id));

-- Service role (edge functions de webhook e sync)
CREATE POLICY "gpm_service_role" ON public.gateway_product_mappings
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Índices para lookups frequentes no webhook
CREATE INDEX IF NOT EXISTS idx_gpm_gateway_external
  ON public.gateway_product_mappings (gateway_id, external_product_id);

CREATE INDEX IF NOT EXISTS idx_gpm_tenant
  ON public.gateway_product_mappings (tenant_id);

-- 4. Remove tabelas antigas (cascade para FK dependentes)
DROP TABLE IF EXISTS public.gateway_offer_products CASCADE;
DROP TABLE IF EXISTS public.gateway_offer_mappings  CASCADE;
