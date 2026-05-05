-- ============================================================
-- Fix: triggers especiais de public_id devem ler o prefixo
-- da tabela public_id_prefixes em vez de usar valor hardcoded.
-- Isso garante que change_public_id_prefix() funcione de ponta
-- a ponta — passado E futuro — para essas 3 tabelas.
-- ============================================================

-- 1. asset_files (PK = asset_id)
CREATE OR REPLACE FUNCTION public.set_public_id_asset_files()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  _prefix TEXT;
BEGIN
  SELECT prefix INTO _prefix
    FROM public.public_id_prefixes
   WHERE table_name = TG_TABLE_NAME;

  NEW.public_id := public.generate_public_id(_prefix, NEW.asset_id);
  RETURN NEW;
END;
$$;

-- 2. asset_videos (PK = asset_id)
CREATE OR REPLACE FUNCTION public.set_public_id_asset_videos()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  _prefix TEXT;
BEGIN
  SELECT prefix INTO _prefix
    FROM public.public_id_prefixes
   WHERE table_name = TG_TABLE_NAME;

  NEW.public_id := public.generate_public_id(_prefix, NEW.asset_id);
  RETURN NEW;
END;
$$;

-- 3. tenant_settings (PK = tenant_id)
CREATE OR REPLACE FUNCTION public.set_public_id_tenant_settings()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  _prefix TEXT;
BEGIN
  SELECT prefix INTO _prefix
    FROM public.public_id_prefixes
   WHERE table_name = TG_TABLE_NAME;

  NEW.public_id := public.generate_public_id(_prefix, NEW.tenant_id);
  RETURN NEW;
END;
$$;
