-- Move campos de negócio de profiles para tenant_settings
-- A migration anterior (20260330200000) adicionou country/referral_source/role_tags em profiles por erro.
-- Agora adicionamos em tenant_settings (onde devem estar) e removemos de profiles.

-- Adicionar em tenant_settings
ALTER TABLE public.tenant_settings
  ADD COLUMN IF NOT EXISTS country text,
  ADD COLUMN IF NOT EXISTS referral_source text,
  ADD COLUMN IF NOT EXISTS role_tags jsonb DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.tenant_settings.country IS 'Código ISO do país do negócio, ex: BR';
COMMENT ON COLUMN public.tenant_settings.referral_source IS 'Como o tenant descobriu a plataforma';
COMMENT ON COLUMN public.tenant_settings.role_tags IS 'Tags descritivas do nicho, ex: ["infoprodutor","coach"]';

-- Remover de profiles (foram adicionados por erro)
ALTER TABLE public.profiles
  DROP COLUMN IF EXISTS country,
  DROP COLUMN IF EXISTS referral_source,
  DROP COLUMN IF EXISTS role_tags;
