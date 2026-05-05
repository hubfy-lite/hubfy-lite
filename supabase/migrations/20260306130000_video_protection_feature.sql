-- ─────────────────────────────────────────────────────────────────────────────
-- Feature: Videos Protegidos (premium)
--
-- 1. Adiciona coluna `plan` em tenant_settings para controle de plano
-- 2. Adiciona `video_protection_enabled` (feature flag por tenant)
-- 3. Adiciona `gumlet_signed_url_secret` (secret por tenant/workspace Gumlet)
-- ─────────────────────────────────────────────────────────────────────────────

-- ════════════════════════════════════════════════════════════
-- 1. Plano do tenant (free | pro | business)
-- ════════════════════════════════════════════════════════════

ALTER TABLE public.tenant_settings
  ADD COLUMN IF NOT EXISTS plan TEXT NOT NULL DEFAULT 'free';

COMMENT ON COLUMN public.tenant_settings.plan IS
  'Plano contratado pelo tenant: free | pro | business. Controla acesso a features premium.';

-- ════════════════════════════════════════════════════════════
-- 2. Flag de proteção de vídeo
-- ════════════════════════════════════════════════════════════

ALTER TABLE public.tenant_settings
  ADD COLUMN IF NOT EXISTS video_protection_enabled BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.tenant_settings.video_protection_enabled IS
  'Quando true, vídeos são servidos via Signed URL do Gumlet — requer plano pro ou superior.';

-- ════════════════════════════════════════════════════════════
-- 3. Secret da Signed URL por workspace Gumlet (por tenant)
-- ════════════════════════════════════════════════════════════

ALTER TABLE public.tenant_settings
  ADD COLUMN IF NOT EXISTS gumlet_signed_url_secret TEXT;

COMMENT ON COLUMN public.tenant_settings.gumlet_signed_url_secret IS
  'Secret retornado pela API do Gumlet ao ativar video_protection.signed_url no workspace.
   Único por workspace (por tenant). Nunca expor via API pública.';
