-- ============================================================
-- Adiciona extensão unaccent para busca sem acentos
-- Necessário para melhorar relevância da busca global
-- ============================================================

CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA extensions;

-- Cria função helper para normalizar texto (remover acentos)
-- Marcada como IMMUTABLE para poder ser usada em índices (GIN/trigram)
CREATE OR REPLACE FUNCTION public.unaccent_text(text)
RETURNS text AS $$
  SELECT extensions.unaccent('extensions.unaccent', $1)
$$ LANGUAGE sql IMMUTABLE;

-- Comentário para referência futura
COMMENT ON FUNCTION public.unaccent_text(text) IS 'Normaliza texto removendo acentos (é → e, ç → c). IMMUTABLE para uso em índices.';
