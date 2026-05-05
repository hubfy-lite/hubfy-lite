-- Create enum types for asset status and type
CREATE TYPE asset_type AS ENUM ('video', 'file');
CREATE TYPE asset_status AS ENUM ('uploading', 'processing', 'ready', 'failed', 'deleted');

-- Main assets table
CREATE TABLE public.assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  type asset_type NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  status asset_status NOT NULL DEFAULT 'uploading',
  size_bytes BIGINT,
  mime_type TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Asset files (for type=file, Supabase Storage)
CREATE TABLE public.asset_files (
  asset_id UUID PRIMARY KEY REFERENCES public.assets(id) ON DELETE CASCADE,
  bucket TEXT NOT NULL DEFAULT 'assets',
  object_path TEXT NOT NULL,
  public_url TEXT,
  checksum TEXT,
  original_filename TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Asset videos (for type=video, Gumlet)
CREATE TABLE public.asset_videos (
  asset_id UUID PRIMARY KEY REFERENCES public.assets(id) ON DELETE CASCADE,
  gumlet_asset_id TEXT NOT NULL,
  gumlet_source_id TEXT,
  playback_url TEXT,
  thumbnail_url TEXT,
  duration_seconds INTEGER,
  processing_meta JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Junction table: lesson_assets (N:N entre lessons e assets)
CREATE TABLE public.lesson_assets_link (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id UUID NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  asset_id UUID NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  label TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(lesson_id, asset_id)
);

-- Indexes for performance
CREATE INDEX idx_assets_tenant_id ON public.assets(tenant_id);
CREATE INDEX idx_assets_status ON public.assets(status);
CREATE INDEX idx_assets_type ON public.assets(type);
CREATE INDEX idx_asset_videos_gumlet_asset_id ON public.asset_videos(gumlet_asset_id);
CREATE INDEX idx_lesson_assets_link_lesson_id ON public.lesson_assets_link(lesson_id);
CREATE INDEX idx_lesson_assets_link_asset_id ON public.lesson_assets_link(asset_id);

-- Updated_at triggers
CREATE TRIGGER update_assets_updated_at
  BEFORE UPDATE ON public.assets
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_asset_files_updated_at
  BEFORE UPDATE ON public.asset_files
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_asset_videos_updated_at
  BEFORE UPDATE ON public.asset_videos
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Helper function: get asset tenant
CREATE OR REPLACE FUNCTION public.get_asset_tenant(_asset_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT tenant_id FROM public.assets WHERE id = _asset_id
$$;

-- Helper function: check if asset and lesson belong to same tenant
CREATE OR REPLACE FUNCTION public.asset_lesson_same_tenant(_asset_id uuid, _lesson_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.assets a
    JOIN public.lessons l ON l.id = _lesson_id
    JOIN public.modules m ON l.module_id = m.id
    JOIN public.courses c ON m.course_id = c.id
    WHERE a.id = _asset_id AND a.tenant_id = c.tenant_id
  )
$$;

-- Enable RLS
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lesson_assets_link ENABLE ROW LEVEL SECURITY;

-- RLS for assets
CREATE POLICY "Editors can view tenant assets"
  ON public.assets FOR SELECT
  USING (is_tenant_editor(tenant_id) OR is_admin());

CREATE POLICY "Editors can create tenant assets"
  ON public.assets FOR INSERT
  WITH CHECK (is_tenant_editor(tenant_id));

CREATE POLICY "Editors can update tenant assets"
  ON public.assets FOR UPDATE
  USING (is_tenant_editor(tenant_id) OR is_admin());

CREATE POLICY "Owners can delete tenant assets"
  ON public.assets FOR DELETE
  USING (is_tenant_owner(tenant_id) OR is_admin());

-- RLS for asset_files
CREATE POLICY "View asset files via asset"
  ON public.asset_files FOR SELECT
  USING (is_tenant_editor(get_asset_tenant(asset_id)) OR is_admin());

CREATE POLICY "Manage asset files via asset"
  ON public.asset_files FOR ALL
  USING (is_tenant_editor(get_asset_tenant(asset_id)) OR is_admin());

-- RLS for asset_videos
CREATE POLICY "View asset videos via asset"
  ON public.asset_videos FOR SELECT
  USING (is_tenant_editor(get_asset_tenant(asset_id)) OR is_admin());

CREATE POLICY "Manage asset videos via asset"
  ON public.asset_videos FOR ALL
  USING (is_tenant_editor(get_asset_tenant(asset_id)) OR is_admin());

-- RLS for lesson_assets_link
CREATE POLICY "Editors can view lesson asset links"
  ON public.lesson_assets_link FOR SELECT
  USING (
    is_tenant_editor(get_course_tenant(get_lesson_course(lesson_id))) 
    OR is_enrolled_in_course(get_lesson_course(lesson_id))
    OR is_admin()
  );

CREATE POLICY "Editors can manage lesson asset links"
  ON public.lesson_assets_link FOR ALL
  USING (is_tenant_editor(get_course_tenant(get_lesson_course(lesson_id))) OR is_admin());

-- Validation trigger: ensure asset and lesson belong to same tenant
CREATE OR REPLACE FUNCTION public.validate_lesson_asset_tenant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT asset_lesson_same_tenant(NEW.asset_id, NEW.lesson_id) THEN
    RAISE EXCEPTION 'Asset and lesson must belong to the same tenant';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_lesson_asset_tenant
  BEFORE INSERT OR UPDATE ON public.lesson_assets_link
  FOR EACH ROW EXECUTE FUNCTION public.validate_lesson_asset_tenant();

-- Create storage bucket for assets
INSERT INTO storage.buckets (id, name, public)
VALUES ('assets', 'assets', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for assets bucket
CREATE POLICY "Editors can upload assets"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'assets' 
    AND (storage.foldername(name))[1] = 'tenant'
    AND is_tenant_editor((storage.foldername(name))[2]::uuid)
  );

CREATE POLICY "Editors can view assets"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'assets'
    AND (storage.foldername(name))[1] = 'tenant'
    AND is_tenant_editor((storage.foldername(name))[2]::uuid)
  );

CREATE POLICY "Editors can update assets"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'assets'
    AND (storage.foldername(name))[1] = 'tenant'
    AND is_tenant_editor((storage.foldername(name))[2]::uuid)
  );

CREATE POLICY "Owners can delete assets"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'assets'
    AND (storage.foldername(name))[1] = 'tenant'
    AND is_tenant_owner((storage.foldername(name))[2]::uuid)
  );