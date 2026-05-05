
-- Add structured video metadata columns to asset_videos
ALTER TABLE public.asset_videos
  ADD COLUMN IF NOT EXISTS width smallint,
  ADD COLUMN IF NOT EXISTS height smallint,
  ADD COLUMN IF NOT EXISTS aspect_ratio text,
  ADD COLUMN IF NOT EXISTS fps real,
  ADD COLUMN IF NOT EXISTS original_size_bytes bigint,
  ADD COLUMN IF NOT EXISTS progress_pct smallint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS transcription_json jsonb;
