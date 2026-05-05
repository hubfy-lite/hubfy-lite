-- Adiciona campos de onboarding
-- profiles: dados pessoais (whatsapp, instagram)
-- tenant_settings: dados do negócio (country, referral_source, role_tags)

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS whatsapp text,
  ADD COLUMN IF NOT EXISTS instagram text;

COMMENT ON COLUMN public.profiles.whatsapp IS 'WhatsApp com código do país, ex: +5511999999999';
COMMENT ON COLUMN public.profiles.instagram IS 'Handle do Instagram normalizado (sem @), ex: meuuser';

ALTER TABLE public.tenant_settings
  ADD COLUMN IF NOT EXISTS country text,
  ADD COLUMN IF NOT EXISTS referral_source text,
  ADD COLUMN IF NOT EXISTS role_tags jsonb DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.tenant_settings.country IS 'Código ISO do país do negócio, ex: BR';
COMMENT ON COLUMN public.tenant_settings.referral_source IS 'Como o tenant descobriu a plataforma';
COMMENT ON COLUMN public.tenant_settings.role_tags IS 'Tags descritivas do nicho, ex: ["infoprodutor","coach"]';
