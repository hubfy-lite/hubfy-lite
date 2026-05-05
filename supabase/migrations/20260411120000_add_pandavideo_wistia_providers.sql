-- Add 'pandavideo' and 'wistia' to the lesson_videos provider CHECK constraint
ALTER TABLE public.lesson_videos DROP CONSTRAINT IF EXISTS lesson_videos_provider_check;
ALTER TABLE public.lesson_videos ADD CONSTRAINT lesson_videos_provider_check
  CHECK (provider IN ('gumlet', 'youtube', 'vimeo', 'smartplayer', 'pandavideo', 'wistia'));

-- Register credential rules for new providers
INSERT INTO public.integration_credential_rules (provider, required_keys) VALUES
  ('pandavideo', ARRAY['api_key']),
  ('wistia',     ARRAY['access_token'])
ON CONFLICT (provider) DO NOTHING;
