-- ============================================================
-- Integração Chargefy: novos campos para sellers + tabela seller_fees
-- ============================================================

-- 1. Tipo de conta bancária (Chargefy exige)
ALTER TABLE public.sellers
  ADD COLUMN IF NOT EXISTS bank_account_type TEXT NOT NULL DEFAULT 'checking'
  CHECK (bank_account_type IN ('checking', 'savings'));

-- 2. Tipo de documento de identidade (CNH ou RG)
ALTER TABLE public.sellers
  ADD COLUMN IF NOT EXISTS identity_doc_type TEXT
  CHECK (identity_doc_type IS NULL OR identity_doc_type IN ('cnh', 'rg'));

-- 3. ID da sub-org devolvido pela Chargefy
ALTER TABLE public.sellers
  ADD COLUMN IF NOT EXISTS external_organization_id TEXT;

CREATE INDEX IF NOT EXISTS idx_sellers_external_org_id
  ON public.sellers (external_organization_id)
  WHERE external_organization_id IS NOT NULL;

-- 4. Sub-tipo do documento (frente/verso)
ALTER TABLE public.seller_documents
  ADD COLUMN IF NOT EXISTS identity_sub_type TEXT
  CHECK (identity_sub_type IS NULL OR identity_sub_type IN ('front', 'back', 'full'));

-- 5. Tabela seller_fees (criada quando seller é aprovado)
CREATE TABLE IF NOT EXISTS public.seller_fees (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id   UUID NOT NULL REFERENCES public.sellers(id) ON DELETE CASCADE,
  fee_percent NUMERIC(5,2) NOT NULL DEFAULT 0
    CHECK (fee_percent >= 0 AND fee_percent <= 50),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT seller_fees_seller_unique UNIQUE (seller_id)
);

-- RLS
ALTER TABLE public.seller_fees ENABLE ROW LEVEL SECURITY;

-- SELECT: membros do tenant veem
CREATE POLICY "seller_fees_select"
  ON public.seller_fees
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.sellers s
      JOIN public.tenant_users tu ON tu.tenant_id = s.tenant_id
      WHERE s.id = seller_fees.seller_id
        AND tu.user_id = auth.uid()
    )
  );

-- INSERT/UPDATE: apenas via edge function (service role)
-- Sem policy de INSERT/UPDATE para users normais — gerenciado pelo backend

-- Trigger updated_at
DROP TRIGGER IF EXISTS set_seller_fees_updated_at ON public.seller_fees;
CREATE TRIGGER set_seller_fees_updated_at
  BEFORE UPDATE ON public.seller_fees
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();
