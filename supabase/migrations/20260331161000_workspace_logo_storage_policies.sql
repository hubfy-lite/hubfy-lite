-- Storage policies for workspace logos in the avatars bucket.
-- Path pattern: workspace/{tenantId}/logo.{ext}
-- Allows tenant editors to upload, update, and delete workspace logos.

-- INSERT: editors do tenant podem subir logo
CREATE POLICY "Workspace editors can upload logo"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = 'workspace'
  AND public.is_tenant_editor((storage.foldername(name))[2]::uuid)
);

-- UPDATE: editors do tenant podem atualizar logo (upsert)
CREATE POLICY "Workspace editors can update logo"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = 'workspace'
  AND public.is_tenant_editor((storage.foldername(name))[2]::uuid)
);

-- DELETE: editors do tenant podem remover logo
CREATE POLICY "Workspace editors can delete logo"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = 'workspace'
  AND public.is_tenant_editor((storage.foldername(name))[2]::uuid)
);
