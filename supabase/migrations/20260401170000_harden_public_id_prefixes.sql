-- =============================================================
-- Hardening: public_id_prefixes
-- =============================================================
-- Objetivo: tornar a tabela public_id_prefixes inacessível por
-- papéis da API (anon, authenticated, service_role) e garantir
-- que somente as trigger functions a consultem, via SECURITY DEFINER.
-- Nenhuma interface pública muda; o frontend não lê essa tabela.
-- =============================================================

-- 1. Habilitar RLS (sem policies = ninguém acessa via API)
ALTER TABLE public.public_id_prefixes ENABLE ROW LEVEL SECURITY;

-- 2. Revogar todos os privilégios dos papéis da API
REVOKE ALL ON TABLE public.public_id_prefixes FROM PUBLIC, anon, authenticated, service_role;

-- 3. Revogar EXECUTE de change_public_id_prefix para papéis da API
--    (continua disponível para owner/superuser via SQL direto)
REVOKE EXECUTE ON FUNCTION public.change_public_id_prefix(text, text) FROM PUBLIC, anon, authenticated, service_role;

-- =============================================================
-- 4. Recriar trigger functions como SECURITY DEFINER
--    Mesma lógica, mesmo nome, mesmos triggers — só muda o modo.
-- =============================================================

-- 4a. set_public_id() — trigger genérico (tabelas com PK "id")
CREATE OR REPLACE FUNCTION public.set_public_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prefix TEXT;
BEGIN
  SELECT prefix INTO v_prefix
    FROM public.public_id_prefixes
   WHERE table_name = TG_TABLE_NAME;

  IF v_prefix IS NOT NULL THEN
    IF NEW.id IS NOT NULL THEN
      NEW.public_id := public.generate_public_id(v_prefix, NEW.id);
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- 4b. set_public_id_asset_files() — PK é asset_id
CREATE OR REPLACE FUNCTION public.set_public_id_asset_files()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

-- 4c. set_public_id_asset_videos() — PK é asset_id
CREATE OR REPLACE FUNCTION public.set_public_id_asset_videos()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

-- 4d. set_public_id_tenant_settings() — PK é tenant_id
CREATE OR REPLACE FUNCTION public.set_public_id_tenant_settings()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

-- 5. Recriar change_public_id_prefix como SECURITY DEFINER
--    (necessário porque ela lê/escreve em public_id_prefixes)
CREATE OR REPLACE FUNCTION public.change_public_id_prefix(
  p_table TEXT,
  p_new_prefix TEXT
)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pk TEXT;
  v_count INT;
BEGIN
  SELECT a.attname INTO v_pk
    FROM pg_index i
    JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
   WHERE i.indrelid = ('public.' || p_table)::regclass
     AND i.indisprimary;

  IF v_pk IS NULL THEN
    RAISE EXCEPTION 'Tabela "%" não encontrada ou sem primary key', p_table;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.public_id_prefixes
     WHERE prefix = p_new_prefix AND table_name != p_table
  ) THEN
    RAISE EXCEPTION 'Prefixo "%" já está em uso por outra tabela', p_new_prefix;
  END IF;

  UPDATE public.public_id_prefixes
     SET prefix = p_new_prefix
   WHERE table_name = p_table;

  EXECUTE format(
    'UPDATE public.%I SET public_id = public.generate_public_id(%L, %I)',
    p_table, p_new_prefix, v_pk
  );

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;
