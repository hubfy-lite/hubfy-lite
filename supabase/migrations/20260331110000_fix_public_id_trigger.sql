-- ============================================================
-- Fix: triggers de public_id para tabelas com PK ≠ "id"
-- O trigger genérico set_public_id() usa NEW.id, que não existe
-- em asset_files (PK=asset_id), asset_videos (PK=asset_id),
-- tenant_settings (PK=tenant_id).
-- Solução: triggers específicos para essas tabelas.
-- ============================================================

-- 1. Trigger específico: asset_files (PK = asset_id)
DROP TRIGGER IF EXISTS trg_public_id ON public.asset_files;

CREATE OR REPLACE FUNCTION public.set_public_id_asset_files()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.public_id := public.generate_public_id('afil', NEW.asset_id);
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_public_id
  BEFORE INSERT ON public.asset_files
  FOR EACH ROW EXECUTE FUNCTION public.set_public_id_asset_files();


-- 2. Trigger específico: asset_videos (PK = asset_id)
DROP TRIGGER IF EXISTS trg_public_id ON public.asset_videos;

CREATE OR REPLACE FUNCTION public.set_public_id_asset_videos()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.public_id := public.generate_public_id('avid', NEW.asset_id);
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_public_id
  BEFORE INSERT ON public.asset_videos
  FOR EACH ROW EXECUTE FUNCTION public.set_public_id_asset_videos();


-- 3. Trigger específico: tenant_settings (PK = tenant_id)
DROP TRIGGER IF EXISTS trg_public_id ON public.tenant_settings;

CREATE OR REPLACE FUNCTION public.set_public_id_tenant_settings()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.public_id := public.generate_public_id('tset', NEW.tenant_id);
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_public_id
  BEFORE INSERT ON public.tenant_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_public_id_tenant_settings();


-- 4. Backfill: preencher registros que possam ter sido inseridos
--    entre o deploy da migration original e este fix
UPDATE public.asset_files
   SET public_id = public.generate_public_id('afil', asset_id)
 WHERE public_id IS NULL;

UPDATE public.asset_videos
   SET public_id = public.generate_public_id('avid', asset_id)
 WHERE public_id IS NULL;

UPDATE public.tenant_settings
   SET public_id = public.generate_public_id('tset', tenant_id)
 WHERE public_id IS NULL;
