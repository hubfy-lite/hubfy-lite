-- Add provider-agnostic video settings to tenant_settings
-- Used for workspace-level player settings sync (Gumlet v1)
ALTER TABLE public.tenant_settings
ADD COLUMN IF NOT EXISTS video_settings jsonb NOT NULL DEFAULT '{
  "provider": "gumlet",
  "player": {
    "preload": true,
    "autoplay": false,
    "loop": false,
    "cast_enabled": true,
    "captions_auto": false,
    "seek_enabled": true,
    "controls_visible": true,
    "title_visible": false,
    "powered_by_gumlet_overlay": false
  }
}'::jsonb;

COMMENT ON COLUMN public.tenant_settings.video_settings IS
'Video provider/player settings as JSONB. v1 provider=gumlet. powered_by_gumlet_overlay is always enforced false.';

-- Product requirement: never show "Powered by Gumlet"
ALTER TABLE public.tenant_settings
DROP CONSTRAINT IF EXISTS tenant_settings_video_settings_no_gumlet_branding;

ALTER TABLE public.tenant_settings
ADD CONSTRAINT tenant_settings_video_settings_no_gumlet_branding
CHECK (
  NOT (
    (video_settings ? 'player')
    AND (video_settings->'player' ? 'powered_by_gumlet_overlay')
    AND lower(video_settings->'player'->>'powered_by_gumlet_overlay') = 'true'
  )
);
