-- Add 'smartplayer' to the lesson_videos provider CHECK constraint
ALTER TABLE public.lesson_videos DROP CONSTRAINT IF EXISTS lesson_videos_provider_check;
ALTER TABLE public.lesson_videos ADD CONSTRAINT lesson_videos_provider_check
  CHECK (provider IN ('gumlet', 'youtube', 'vimeo', 'smartplayer'));
