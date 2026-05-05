-- Add optional player color override to video_settings.
-- Null means "fallback to tenant brand color".
ALTER TABLE public.tenant_settings
ALTER COLUMN video_settings SET DEFAULT '{
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
    "player_color": null,
    "powered_by_gumlet_overlay": false
  }
}'::jsonb;

UPDATE public.tenant_settings
SET video_settings = jsonb_set(
  video_settings,
  '{player,player_color}',
  'null'::jsonb,
  true
)
WHERE NOT (
  (video_settings ? 'player')
  AND (video_settings->'player' ? 'player_color')
);
