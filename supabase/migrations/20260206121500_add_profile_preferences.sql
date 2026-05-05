ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS preferences jsonb NOT NULL DEFAULT '{"theme":"dark"}'::jsonb;

UPDATE public.profiles
SET preferences = jsonb_set(
  COALESCE(preferences, '{}'::jsonb),
  '{theme}',
  to_jsonb('dark'::text),
  true
)
WHERE preferences IS NULL OR NOT (preferences ? 'theme');
