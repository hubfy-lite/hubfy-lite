-- Create public bucket for lesson content images (rich text editor)
-- Images inserted via TipTap editor need to be publicly accessible
INSERT INTO storage.buckets (id, name, public)
VALUES ('content-images', 'content-images', true)
ON CONFLICT (id) DO NOTHING;

-- Allow editors to upload content images (scoped to their tenant path)
CREATE POLICY "Editors can upload content images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'content-images'
  AND (storage.foldername(name))[1] = 'tenant'
  AND is_tenant_editor((storage.foldername(name))[2]::uuid)
);

-- Allow editors to update content images
CREATE POLICY "Editors can update content images"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'content-images'
  AND (storage.foldername(name))[1] = 'tenant'
  AND is_tenant_editor((storage.foldername(name))[2]::uuid)
);

-- Allow anyone to view content images (public bucket)
CREATE POLICY "Anyone can view content images"
ON storage.objects FOR SELECT
USING (bucket_id = 'content-images');

-- Allow editors to delete content images
CREATE POLICY "Editors can delete content images"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'content-images'
  AND (storage.foldername(name))[1] = 'tenant'
  AND is_tenant_editor((storage.foldername(name))[2]::uuid)
);
