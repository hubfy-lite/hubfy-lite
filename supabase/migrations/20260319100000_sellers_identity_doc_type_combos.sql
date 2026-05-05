-- ============================================================
-- Alterar identity_doc_type para 3 combinações de documentos
-- Antes: 'cnh' | 'rg'
-- Agora: 'selfie_cnh_full' | 'selfie_cnh_front_back' | 'selfie_rg_front_back'
-- ============================================================

-- 1. Remover CHECK constraint antiga PRIMEIRO (para permitir os novos valores)
ALTER TABLE public.sellers
  DROP CONSTRAINT IF EXISTS sellers_identity_doc_type_check;

-- 2. Migrar dados existentes
UPDATE public.sellers
SET identity_doc_type = 'selfie_cnh_front_back'
WHERE identity_doc_type = 'cnh';

UPDATE public.sellers
SET identity_doc_type = 'selfie_rg_front_back'
WHERE identity_doc_type = 'rg';

-- 3. Adicionar nova CHECK constraint
ALTER TABLE public.sellers
  ADD CONSTRAINT sellers_identity_doc_type_check
  CHECK (
    identity_doc_type IS NULL
    OR identity_doc_type IN (
      'selfie_cnh_full',
      'selfie_cnh_front_back',
      'selfie_rg_front_back'
    )
  );
