-- Migration: video_progress_tracking_enabled + facebook_pixel_id + ga_tracking_id
-- Data: 2026-03-07

-- Feature flag para rastreamento de progresso de vídeo (Pro)
ALTER TABLE public.tenant_settings
  ADD COLUMN IF NOT EXISTS video_progress_tracking_enabled BOOLEAN NOT NULL DEFAULT false;

-- Campos para marketing pixels (Pro)
ALTER TABLE public.tenant_settings
  ADD COLUMN IF NOT EXISTS facebook_pixel_id TEXT,
  ADD COLUMN IF NOT EXISTS ga_tracking_id TEXT;

-- Comentários
COMMENT ON COLUMN public.tenant_settings.video_progress_tracking_enabled IS 'Habilita rastreamento de progresso de vídeo por aluno (feature Pro)';
COMMENT ON COLUMN public.tenant_settings.facebook_pixel_id IS 'ID do Facebook Pixel para rastreamento via Gumlet (feature Pro)';
COMMENT ON COLUMN public.tenant_settings.ga_tracking_id IS 'ID de rastreamento do Google Analytics 4 (ex: G-XXXXXXXX) via Gumlet (feature Pro)';
