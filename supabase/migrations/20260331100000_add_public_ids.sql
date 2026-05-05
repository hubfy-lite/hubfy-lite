-- ============================================================
-- Public IDs com prefixo (estilo Stripe)
-- Adiciona coluna public_id a todas as tabelas com id uuid
-- Formato: prefixo_12charsDoUUID  (ex: prod_a1b2c3d4e5f6)
-- ============================================================

-- 1. Tabela de registro: mapeia tabela → prefixo
--    Usada pelos triggers e pode ser consultada no futuro
CREATE TABLE IF NOT EXISTS public.public_id_prefixes (
  table_name  TEXT PRIMARY KEY,
  prefix      TEXT NOT NULL UNIQUE
);

INSERT INTO public.public_id_prefixes (table_name, prefix) VALUES
  ('profiles',                  'user'),
  ('tenants',                   'tnnt'),
  ('tenant_users',              'tusr'),
  ('tenant_gateways',           'tgtw'),
  ('tenant_integrations',       'tint'),
  ('tenant_integration_secrets','tsec'),
  ('tenant_settings',           'tset'),
  ('user_roles',                'urol'),
  ('customers',                 'cust'),
  ('products',                  'prod'),
  ('courses',                   'crse'),
  ('modules',                   'modl'),
  ('lessons',                   'less'),
  ('lesson_blocks',             'lblk'),
  ('lesson_assets',             'last'),
  ('lesson_videos',             'lvid'),
  ('lesson_progress',           'lpro'),
  ('lesson_assets_link',        'lalk'),
  ('showcases',                 'show'),
  ('showcase_courses',          'shcr'),
  ('showcase_customers',        'shcu'),
  ('assets',                    'asst'),
  ('asset_files',               'afil'),
  ('asset_videos',              'avid'),
  ('asset_folders',             'afdr'),
  ('prices',                    'prce'),
  ('checkouts',                 'chkt'),
  ('orders',                    'ordr'),
  ('subscriptions',             'subs'),
  ('product_showcases',         'pshw'),
  ('product_assets',            'past'),
  ('product_courses',           'pcrs'),
  ('course_customers',          'ccst'),
  ('gateway_events',            'gevt'),
  ('email_logs',                'elog'),
  ('sellers',                   'selr'),
  ('seller_documents',          'sdoc'),
  ('seller_events',             'sevt'),
  ('seller_fees',               'sfee'),
  ('portal_auth_requests',      'paut')
ON CONFLICT (table_name) DO NOTHING;


-- 2. Função genérica: gera public_id a partir de prefixo + uuid
CREATE OR REPLACE FUNCTION public.generate_public_id(prefix TEXT, id UUID)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT prefix || '_' || left(replace(id::text, '-', ''), 12);
$$;


-- 3. Trigger genérico: busca o prefixo na tabela de registro
CREATE OR REPLACE FUNCTION public.set_public_id()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_prefix TEXT;
  v_pk TEXT;
BEGIN
  SELECT prefix INTO v_prefix
    FROM public.public_id_prefixes
   WHERE table_name = TG_TABLE_NAME;

  IF v_prefix IS NOT NULL THEN
    -- Tentar usar NEW.id; se não existir, buscar a PK real
    IF NEW.id IS NOT NULL THEN
      NEW.public_id := public.generate_public_id(v_prefix, NEW.id);
    END IF;
  END IF;

  RETURN NEW;
END;
$$;


-- 4. Helper: cria coluna, preenche dados existentes e cria trigger
CREATE OR REPLACE FUNCTION public._setup_public_id(p_table TEXT, p_prefix TEXT, p_pk TEXT DEFAULT 'id')
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  -- Adicionar coluna se não existe
  EXECUTE format(
    'ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS public_id TEXT',
    p_table
  );

  -- Backfill registros existentes
  EXECUTE format(
    'UPDATE public.%I SET public_id = public.generate_public_id(%L, %I) WHERE public_id IS NULL',
    p_table, p_prefix, p_pk
  );

  -- Adicionar constraint UNIQUE (se não existe)
  BEGIN
    EXECUTE format(
      'ALTER TABLE public.%I ADD CONSTRAINT %I UNIQUE (public_id)',
      p_table, p_table || '_public_id_key'
    );
  EXCEPTION WHEN duplicate_table THEN
    NULL; -- constraint já existe
  END;

  -- Criar trigger (drop + create pra ser idempotente)
  EXECUTE format(
    'DROP TRIGGER IF EXISTS trg_public_id ON public.%I',
    p_table
  );
  EXECUTE format(
    'CREATE TRIGGER trg_public_id BEFORE INSERT ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_public_id()',
    p_table
  );
END;
$$;


-- 5. Aplicar em todas as tabelas (nomes reais do banco remoto)
SELECT public._setup_public_id('profiles',                  'user');
SELECT public._setup_public_id('tenants',                   'tnnt');
SELECT public._setup_public_id('tenant_users',              'tusr');
SELECT public._setup_public_id('tenant_gateways',           'tgtw');
SELECT public._setup_public_id('tenant_integrations',       'tint');
SELECT public._setup_public_id('tenant_integration_secrets','tsec');
SELECT public._setup_public_id('user_roles',                'urol');
SELECT public._setup_public_id('customers',                 'cust');
SELECT public._setup_public_id('products',                  'prod');
SELECT public._setup_public_id('courses',                   'crse');
SELECT public._setup_public_id('modules',                   'modl');
SELECT public._setup_public_id('lessons',                   'less');
SELECT public._setup_public_id('lesson_blocks',             'lblk');
SELECT public._setup_public_id('lesson_assets',             'last');
SELECT public._setup_public_id('lesson_videos',             'lvid');
SELECT public._setup_public_id('lesson_progress',           'lpro');
SELECT public._setup_public_id('lesson_assets_link',        'lalk');
SELECT public._setup_public_id('showcases',                 'show');
SELECT public._setup_public_id('showcase_courses',          'shcr');
SELECT public._setup_public_id('showcase_customers',        'shcu');
SELECT public._setup_public_id('assets',                    'asst');
SELECT public._setup_public_id('asset_folders',             'afdr');
SELECT public._setup_public_id('prices',                    'prce');
SELECT public._setup_public_id('checkouts',                 'chkt');
SELECT public._setup_public_id('orders',                    'ordr');
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'subscriptions') THEN
    PERFORM public._setup_public_id('subscriptions', 'subs');
  END IF;
END $$;
SELECT public._setup_public_id('product_showcases',         'pshw');
SELECT public._setup_public_id('product_assets',            'past');
SELECT public._setup_public_id('product_courses',           'pcrs');
SELECT public._setup_public_id('course_customers',          'ccst');
SELECT public._setup_public_id('gateway_events',            'gevt');
SELECT public._setup_public_id('email_logs',                'elog');
SELECT public._setup_public_id('sellers',                   'selr');
SELECT public._setup_public_id('seller_documents',          'sdoc');
SELECT public._setup_public_id('seller_events',             'sevt');
SELECT public._setup_public_id('seller_fees',               'sfee');
SELECT public._setup_public_id('portal_auth_requests',      'paut');

-- Tabelas com PK diferente de "id":
-- asset_files e asset_videos usam asset_id como PK
SELECT public._setup_public_id('asset_files',  'afil', 'asset_id');
SELECT public._setup_public_id('asset_videos', 'avid', 'asset_id');
-- tenant_settings usa tenant_id como PK
SELECT public._setup_public_id('tenant_settings', 'tset', 'tenant_id');


-- 6. Limpar a função helper (não precisa mais)
DROP FUNCTION public._setup_public_id(TEXT, TEXT, TEXT);


-- 7. Função utilitária: trocar o prefixo de uma tabela e recalcular todos os public_ids
--    Uso: SELECT public.change_public_id_prefix('products', 'item');
--    Isso muda prod_xxxx → item_xxxx em todos os registros
CREATE OR REPLACE FUNCTION public.change_public_id_prefix(
  p_table TEXT,
  p_new_prefix TEXT
)
RETURNS INT
LANGUAGE plpgsql
AS $$
DECLARE
  v_pk TEXT;
  v_count INT;
BEGIN
  -- Descobrir qual é a PK da tabela (id ou tenant_id etc)
  SELECT a.attname INTO v_pk
    FROM pg_index i
    JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
   WHERE i.indrelid = ('public.' || p_table)::regclass
     AND i.indisprimary;

  IF v_pk IS NULL THEN
    RAISE EXCEPTION 'Tabela "%" não encontrada ou sem primary key', p_table;
  END IF;

  -- Verificar se o novo prefixo não conflita com outra tabela
  IF EXISTS (
    SELECT 1 FROM public.public_id_prefixes
     WHERE prefix = p_new_prefix AND table_name != p_table
  ) THEN
    RAISE EXCEPTION 'Prefixo "%" já está em uso por outra tabela', p_new_prefix;
  END IF;

  -- Atualizar o registro de prefixos
  UPDATE public.public_id_prefixes
     SET prefix = p_new_prefix
   WHERE table_name = p_table;

  -- Recalcular todos os public_ids da tabela
  EXECUTE format(
    'UPDATE public.%I SET public_id = public.generate_public_id(%L, %I)',
    p_table, p_new_prefix, v_pk
  );

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;
