-- Fix videos that already have playback_url and thumbnail_url but are stuck in 'processing'
UPDATE public.assets 
SET status = 'ready' 
WHERE id IN (
  SELECT a.id FROM public.assets a
  JOIN public.asset_videos av ON av.asset_id = a.id
  WHERE a.type = 'video' 
    AND a.status = 'processing'
    AND av.playback_url IS NOT NULL
    AND av.thumbnail_url IS NOT NULL
);