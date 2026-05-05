-- Create public bucket for course covers (non-sensitive images)
INSERT INTO storage.buckets (id, name, public)
VALUES ('covers', 'covers', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload covers
CREATE POLICY "Authenticated users can upload covers"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'covers' AND auth.role() = 'authenticated');

-- Allow authenticated users to update their covers
CREATE POLICY "Authenticated users can update covers"
ON storage.objects FOR UPDATE
USING (bucket_id = 'covers' AND auth.role() = 'authenticated');

-- Allow anyone to view covers (public bucket)
CREATE POLICY "Anyone can view covers"
ON storage.objects FOR SELECT
USING (bucket_id = 'covers');

-- Allow authenticated users to delete covers
CREATE POLICY "Authenticated users can delete covers"
ON storage.objects FOR DELETE
USING (bucket_id = 'covers' AND auth.role() = 'authenticated');