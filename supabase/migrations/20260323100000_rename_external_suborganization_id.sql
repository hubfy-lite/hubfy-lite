-- Unifica external_seller_id + external_organization_id → external_suborganization_id
-- Chargefy chama de "suborganization", nosso campo deve refletir isso.

-- 1. Adiciona o novo campo
ALTER TABLE public.sellers
  ADD COLUMN IF NOT EXISTS external_suborganization_id TEXT;

-- 2. Migra dados existentes (prioriza external_organization_id, fallback external_seller_id)
UPDATE public.sellers
SET external_suborganization_id = COALESCE(external_organization_id, external_seller_id)
WHERE external_suborganization_id IS NULL
  AND (external_organization_id IS NOT NULL OR external_seller_id IS NOT NULL);

-- 3. Cria índice no novo campo
CREATE INDEX IF NOT EXISTS idx_sellers_external_suborg_id
  ON public.sellers (external_suborganization_id)
  WHERE external_suborganization_id IS NOT NULL;

-- 4. Remove campos antigos e seus índices
DROP INDEX IF EXISTS idx_sellers_external_id;
DROP INDEX IF EXISTS idx_sellers_external_org_id;

ALTER TABLE public.sellers DROP COLUMN IF EXISTS external_seller_id;
ALTER TABLE public.sellers DROP COLUMN IF EXISTS external_organization_id;
