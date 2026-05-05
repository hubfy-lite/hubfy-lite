-- ============================================================
-- Migration: Permitir alunos verem e baixarem asset_files
--            de aulas em que estão matriculados
--            (e, como bônus, de produtos tipo files que compraram)
--
-- Motivação: a RLS original (20260206191410) permitia apenas
-- is_tenant_editor/is_admin em assets, asset_files e no bucket
-- 'assets' do storage. Isso bloqueia a query aninhada usada pelo
-- aluno em useLesson.ts (lesson_assets_link → assets → asset_files)
-- e o createSignedUrl em LessonFilesTab.tsx.
--
-- Espelha o padrão de 20260411190000_fix_product_links_security.sql,
-- que já adicionou uma policy "Purchasers can view" para product_links.
-- ============================================================

-- 1. Helper function unificada — "este asset é acessível ao user logado?"
CREATE OR REPLACE FUNCTION public.is_asset_available_to_user(_asset_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT
    -- Editor/admin do tenant do asset (mantém acesso de staff)
    public.is_tenant_editor(public.get_asset_tenant(_asset_id))
    OR public.is_admin()
    -- Aluno matriculado em curso que contém o asset via lesson_assets_link
    OR EXISTS (
      SELECT 1
        FROM public.lesson_assets_link lal
       WHERE lal.asset_id = _asset_id
         AND public.is_enrolled_in_course(public.get_lesson_course(lal.lesson_id))
    )
    -- Comprador de produto tipo files que contém o asset
    OR EXISTS (
      SELECT 1
        FROM public.product_assets pa
        JOIN public.orders o ON o.product_id = pa.product_id
        JOIN public.customers c ON c.id = o.customer_id
       WHERE pa.asset_id = _asset_id
         AND c.user_id = auth.uid()
         AND o.status IN ('approved', 'completed')
    )
$$;

-- 2. Policies adicionais — coexistem com as policies de editor existentes
--    ("Editors can view tenant assets" e "View asset files via asset").
--    Policies SELECT no Postgres são unidas por OR, então staff continua
--    vendo tudo; alunos/purchasers ganham o acesso adicional.
CREATE POLICY "Students can view accessible assets"
  ON public.assets FOR SELECT
  USING (public.is_asset_available_to_user(id));

CREATE POLICY "Students can view accessible asset files"
  ON public.asset_files FOR SELECT
  USING (public.is_asset_available_to_user(asset_id));

-- 3. Storage: permitir download via createSignedUrl
--    O LIKE 'tenant/<tenant_id>/%' ancora o objeto à pasta do tenant dono
--    do asset, prevenindo cross-tenant leak caso algum dia dois tenants
--    colidissem em object_path. Padrão de path:
--    tenant/{tenant_id}/{asset_id}/{filename}
--    (ver supabase/functions/asset-upload-file/index.ts)
CREATE POLICY "Students can download accessible asset files"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'assets'
    AND EXISTS (
      SELECT 1
        FROM public.asset_files af
        JOIN public.assets a ON a.id = af.asset_id
       WHERE af.bucket = 'assets'
         AND af.object_path = storage.objects.name
         AND storage.objects.name LIKE 'tenant/' || a.tenant_id::text || '/%'
         AND public.is_asset_available_to_user(af.asset_id)
    )
  );

-- 4. Future-proofing: garantir unicidade de (bucket, object_path).
--    A policy de storage acima assume que o par (bucket, object_path)
--    identifica unicamente um asset_files — esse índice documenta e
--    impõe essa invariante.
CREATE UNIQUE INDEX IF NOT EXISTS idx_asset_files_bucket_object_path
  ON public.asset_files (bucket, object_path);
