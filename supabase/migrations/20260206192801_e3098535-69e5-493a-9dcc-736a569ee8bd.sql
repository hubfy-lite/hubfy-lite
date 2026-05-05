-- 1. UNIQUE constraint para evitar duplicidade em lesson_assets_link
ALTER TABLE public.lesson_assets_link
ADD CONSTRAINT lesson_assets_link_lesson_asset_unique UNIQUE (lesson_id, asset_id);

-- 2. XOR constraint: asset só pode ter linha em asset_files OU asset_videos, nunca ambos
-- Criamos funções helper para validar

CREATE OR REPLACE FUNCTION public.asset_has_file(_asset_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.asset_files WHERE asset_id = _asset_id)
$$;

CREATE OR REPLACE FUNCTION public.asset_has_video(_asset_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.asset_videos WHERE asset_id = _asset_id)
$$;

-- Trigger para asset_files: impede insert se já existe video
CREATE OR REPLACE FUNCTION public.validate_asset_file_xor()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF asset_has_video(NEW.asset_id) THEN
    RAISE EXCEPTION 'Asset already has a video record. Cannot add file record.';
  END IF;
  
  -- Valida que o asset.type = 'file'
  IF NOT EXISTS (SELECT 1 FROM public.assets WHERE id = NEW.asset_id AND type = 'file') THEN
    RAISE EXCEPTION 'Asset type must be "file" to add file record.';
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_asset_file_xor
BEFORE INSERT ON public.asset_files
FOR EACH ROW
EXECUTE FUNCTION public.validate_asset_file_xor();

-- Trigger para asset_videos: impede insert se já existe file
CREATE OR REPLACE FUNCTION public.validate_asset_video_xor()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF asset_has_file(NEW.asset_id) THEN
    RAISE EXCEPTION 'Asset already has a file record. Cannot add video record.';
  END IF;
  
  -- Valida que o asset.type = 'video'
  IF NOT EXISTS (SELECT 1 FROM public.assets WHERE id = NEW.asset_id AND type = 'video') THEN
    RAISE EXCEPTION 'Asset type must be "video" to add video record.';
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_asset_video_xor
BEFORE INSERT ON public.asset_videos
FOR EACH ROW
EXECUTE FUNCTION public.validate_asset_video_xor();

-- 3. Index para listagem de assets por tenant (performance)
CREATE INDEX IF NOT EXISTS idx_assets_tenant_created 
ON public.assets (tenant_id, created_at DESC);