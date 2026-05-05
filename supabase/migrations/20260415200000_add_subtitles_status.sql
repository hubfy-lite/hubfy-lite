-- Track auto-generated subtitle processing lifecycle per video asset.
-- NULL = video without auto-subtitles (legacy uploads)
-- 'generating' = subtitles requested, still processing
-- 'ready' = subtitles available in the player

ALTER TABLE asset_videos ADD COLUMN subtitles_status text;

-- Backfill: recent uploads that were sent with generate_subtitles
-- are already processed — mark as ready.
UPDATE asset_videos
SET subtitles_status = 'ready'
WHERE processing_meta::text LIKE '%generate_subtitles%';
