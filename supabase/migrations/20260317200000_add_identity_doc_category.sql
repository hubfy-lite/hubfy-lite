-- Adiciona valor "identity" ao enum seller_document_category
-- Necessário para o novo fluxo simplificado de documentos (selfie + identity genérico)
ALTER TYPE public.seller_document_category ADD VALUE IF NOT EXISTS 'identity';
