-- ============================================================
-- Refactoring: tenant_settings + novo fluxo de criação de tenant
--
-- 1. Cria tabela tenant_settings (1 row por tenant, colunas tipadas)
-- 2. Migra dados das ~25 colunas de settings de tenants → tenant_settings
-- 3. Remove colunas de settings de tenants (fica só: id, slug, name, created_by, timestamps)
-- 4. RLS em tenant_settings
-- 5. Trigger updated_at
-- 6. Atualiza handle_new_tenant() → auto-cria tenant_settings
-- 7. Atualiza handle_new_user() → NÃO cria mais tenant/onboarding
-- 8. Atualiza RPC get_public_checkout() → JOIN com tenant_settings
-- 9. Índice em zoop_seller_id
-- ============================================================

-- ════════════════════════════════════════════════════════════
-- 1. CRIAR TABELA tenant_settings
-- ════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.tenant_settings (
  tenant_id        uuid PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,

  -- Identidade / branding
  description      text,
  logo_url         text,
  icon_url         text,
  default_language text DEFAULT 'pt-BR',
  primary_color    text,
  accent_color     text,
  theme_mode       text NOT NULL DEFAULT 'light',
  hero_image_url   text,

  -- Checkout design
  checkout_use_brand_colors boolean NOT NULL DEFAULT true,
  checkout_bg_color         text,
  checkout_button_color     text,
  checkout_button_style     text NOT NULL DEFAULT 'pill',
  checkout_font_family      text NOT NULL DEFAULT 'Inter',

  -- Portal design
  portal_use_brand_colors boolean NOT NULL DEFAULT true,
  portal_theme_mode       text NOT NULL DEFAULT 'dark',
  portal_bg_image_url     text,
  portal_button_color     text,
  portal_button_style     text NOT NULL DEFAULT 'rounded',

  -- Comunicação / contato (novos campos)
  email_sender_name  text,
  enable_sale_emails boolean NOT NULL DEFAULT true,
  support_email      text,
  website_url        text,
  whatsapp           text,

  -- Integrações
  gumlet_workspace_id  text,
  zoop_seller_id       text,
  zoop_seller_type     text,
  zoop_seller_status   text NOT NULL DEFAULT 'none',
  zoop_bank_account_id text,

  -- Timestamps
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Comentário na tabela
COMMENT ON TABLE public.tenant_settings IS 'Settings/configurações de cada tenant — 1 row por tenant';

-- ════════════════════════════════════════════════════════════
-- 2. MIGRAR DADOS (tenants → tenant_settings)
-- ════════════════════════════════════════════════════════════

INSERT INTO public.tenant_settings (
  tenant_id,
  description,
  logo_url,
  icon_url,
  default_language,
  primary_color,
  accent_color,
  theme_mode,
  hero_image_url,
  checkout_use_brand_colors,
  checkout_bg_color,
  checkout_button_color,
  checkout_button_style,
  checkout_font_family,
  portal_use_brand_colors,
  portal_theme_mode,
  portal_bg_image_url,
  portal_button_color,
  portal_button_style,
  email_sender_name,
  enable_sale_emails,
  gumlet_workspace_id,
  zoop_seller_id,
  zoop_seller_type,
  zoop_seller_status,
  zoop_bank_account_id,
  created_at,
  updated_at
)
SELECT
  t.id,
  t.description,
  t.logo_url,
  t.icon_url,
  t.default_language,
  t.primary_color,
  t.accent_color,
  t.theme_mode,
  t.hero_image_url,
  t.checkout_use_brand_colors,
  t.checkout_bg_color,
  t.checkout_button_color,
  t.checkout_button_style,
  t.checkout_font_family,
  t.portal_use_brand_colors,
  t.portal_theme_mode,
  t.portal_bg_image_url,
  t.portal_button_color,
  t.portal_button_style,
  t.email_sender_name,
  t.enable_sale_emails,
  t.gumlet_workspace_id,
  NULL, -- zoop_seller_id (never existed in Lite)
  NULL, -- zoop_seller_type
  'none', -- zoop_seller_status (NOT NULL default)
  NULL, -- zoop_bank_account_id
  t.created_at,
  t.updated_at
FROM public.tenants t
ON CONFLICT (tenant_id) DO NOTHING;

-- ════════════════════════════════════════════════════════════
-- 3. DROPAR COLUNAS DE SETTINGS DE tenants
-- ════════════════════════════════════════════════════════════
-- Após esta operação, tenants fica com: id, slug, name, created_by, created_at, updated_at

ALTER TABLE public.tenants
  DROP COLUMN IF EXISTS description,
  DROP COLUMN IF EXISTS logo_url,
  DROP COLUMN IF EXISTS icon_url,
  DROP COLUMN IF EXISTS default_language,
  DROP COLUMN IF EXISTS primary_color,
  DROP COLUMN IF EXISTS accent_color,
  DROP COLUMN IF EXISTS theme_mode,
  DROP COLUMN IF EXISTS hero_image_url,
  DROP COLUMN IF EXISTS checkout_use_brand_colors,
  DROP COLUMN IF EXISTS checkout_bg_color,
  DROP COLUMN IF EXISTS checkout_button_color,
  DROP COLUMN IF EXISTS checkout_button_style,
  DROP COLUMN IF EXISTS checkout_font_family,
  DROP COLUMN IF EXISTS portal_use_brand_colors,
  DROP COLUMN IF EXISTS portal_theme_mode,
  DROP COLUMN IF EXISTS portal_bg_image_url,
  DROP COLUMN IF EXISTS portal_button_color,
  DROP COLUMN IF EXISTS portal_button_style,
  DROP COLUMN IF EXISTS email_sender_name,
  DROP COLUMN IF EXISTS enable_sale_emails,
  DROP COLUMN IF EXISTS gumlet_workspace_id,
  DROP COLUMN IF EXISTS zoop_seller_id,
  DROP COLUMN IF EXISTS zoop_seller_type,
  DROP COLUMN IF EXISTS zoop_seller_status,
  DROP COLUMN IF EXISTS zoop_bank_account_id;

-- ════════════════════════════════════════════════════════════
-- 4. RLS em tenant_settings
-- ════════════════════════════════════════════════════════════

ALTER TABLE public.tenant_settings ENABLE ROW LEVEL SECURITY;

-- SELECT: membros do tenant veem tudo; anon/público usa RPC (get_public_checkout)
CREATE POLICY "tenant_settings_select_member"
  ON public.tenant_settings
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.tenant_users tu
      WHERE tu.tenant_id = tenant_settings.tenant_id
        AND tu.user_id = auth.uid()
    )
  );

-- INSERT: apenas owner do tenant (trigger handle_new_tenant usa SECURITY DEFINER)
CREATE POLICY "tenant_settings_insert_owner"
  ON public.tenant_settings
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tenant_users tu
      WHERE tu.tenant_id = tenant_settings.tenant_id
        AND tu.user_id = auth.uid()
        AND tu.role = 'owner'
    )
  );

-- UPDATE: owner ou editor do tenant
CREATE POLICY "tenant_settings_update_member"
  ON public.tenant_settings
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.tenant_users tu
      WHERE tu.tenant_id = tenant_settings.tenant_id
        AND tu.user_id = auth.uid()
        AND tu.role IN ('owner', 'editor')
    )
  );

-- DELETE: apenas owner (raro, quase nunca usado)
CREATE POLICY "tenant_settings_delete_owner"
  ON public.tenant_settings
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.tenant_users tu
      WHERE tu.tenant_id = tenant_settings.tenant_id
        AND tu.user_id = auth.uid()
        AND tu.role = 'owner'
    )
  );

-- ════════════════════════════════════════════════════════════
-- 5. TRIGGER updated_at
-- ════════════════════════════════════════════════════════════

-- Reusar a função moddatetime se existir, senão criar uma genérica
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_tenant_settings_updated_at ON public.tenant_settings;
CREATE TRIGGER set_tenant_settings_updated_at
  BEFORE UPDATE ON public.tenant_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- ════════════════════════════════════════════════════════════
-- 6. ATUALIZAR handle_new_tenant()
--    Agora também cria a row em tenant_settings (com defaults)
-- ════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.handle_new_tenant()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.created_by IS NULL THEN
    RAISE EXCEPTION 'Tenant must define created_by';
  END IF;

  -- Cria vínculo owner
  INSERT INTO public.tenant_users (tenant_id, user_id, role)
  VALUES (NEW.id, NEW.created_by, 'owner')
  ON CONFLICT (tenant_id, user_id) DO UPDATE
    SET role = 'owner';

  -- Cria tenant_settings com defaults
  INSERT INTO public.tenant_settings (tenant_id)
  VALUES (NEW.id)
  ON CONFLICT (tenant_id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ════════════════════════════════════════════════════════════
-- 7. ATUALIZAR handle_new_user()
--    Signup de tenant: apenas cria profile + role (NÃO cria tenant nem onboarding)
--    Signup de customer: mantém igual
-- ════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  v_signup_as text;
  v_customer_tenant_id uuid;
  v_team_member_tenant_id uuid;
BEGIN
  -- Sempre cria profile
  INSERT INTO public.profiles (user_id, name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'name', NEW.email));

  v_signup_as := COALESCE(NEW.raw_user_meta_data->>'signup_as', 'tenant');

  IF v_signup_as = 'customer' THEN
    -- ── Customer signup (mantém igual) ──
    v_customer_tenant_id := (NEW.raw_user_meta_data->>'customer_tenant_id')::uuid;

    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'customer')
    ON CONFLICT DO NOTHING;

    IF v_customer_tenant_id IS NOT NULL THEN
      INSERT INTO public.customers (tenant_id, user_id, name, email)
      VALUES (
        v_customer_tenant_id,
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
        NEW.email
      )
      ON CONFLICT (tenant_id, user_id) DO NOTHING;
    END IF;

  ELSIF v_signup_as = 'team_member' THEN
    -- ── Team member invite: recebe role tenant + vínculo com tenant ──
    v_team_member_tenant_id := (NEW.raw_user_meta_data->>'team_member_tenant_id')::uuid;

    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'tenant')
    ON CONFLICT DO NOTHING;

    -- Vincula ao tenant do convite como editor ativo
    IF v_team_member_tenant_id IS NOT NULL THEN
      INSERT INTO public.tenant_users (tenant_id, user_id, role, status)
      VALUES (v_team_member_tenant_id, NEW.id, 'editor', 'active')
      ON CONFLICT (tenant_id, user_id) DO UPDATE SET status = 'active';
    END IF;

  ELSE
    -- ── Tenant signup (NOVO: apenas role, sem criar tenant/onboarding) ──
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'tenant')
    ON CONFLICT DO NOTHING;

    -- Tenant será criado depois pelo user via "New Workspace" wizard
  END IF;

  RETURN NEW;
END;
$function$;

-- ════════════════════════════════════════════════════════════
-- 8. ATUALIZAR RPC get_public_checkout()
--    JOIN com tenant_settings para campos de design
-- ════════════════════════════════════════════════════════════

DROP FUNCTION IF EXISTS public.get_public_checkout(text);

CREATE OR REPLACE FUNCTION public.get_public_checkout(
  p_checkout_smart_id text
)
RETURNS TABLE (
  id uuid,
  smart_id text,
  title text,
  description text,
  collect_phone boolean,
  collect_address boolean,
  collect_fiscal_id boolean,
  allow_discount_codes boolean,
  expires_at timestamptz,
  cover_url text,
  confirmation_message text,
  success_url text,
  -- product fields
  product_name text,
  product_cover_url text,
  product_status text,
  -- price fields
  unit_amount integer,
  currency text,
  price_category text,
  renewal_interval_unit text,
  renewal_interval_quantity integer,
  -- tenant fields (de tenants)
  tenant_name text,
  tenant_slug text,
  -- tenant settings fields (de tenant_settings)
  tenant_logo_url text,
  tenant_icon_url text,
  tenant_primary_color text,
  tenant_theme_mode text,
  -- design fields (de tenant_settings)
  checkout_use_brand_colors boolean,
  checkout_bg_color text,
  checkout_button_color text,
  checkout_button_style text,
  checkout_font_family text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    c.smart_id,
    c.title,
    c.description,
    c.collect_phone,
    c.collect_address,
    c.collect_fiscal_id,
    c.allow_discount_codes,
    c.expires_at,
    c.cover_url,
    c.confirmation_message,
    c.success_url,
    p.name AS product_name,
    p.cover_url AS product_cover_url,
    p.status::text AS product_status,
    pr.unit_amount,
    pr.currency,
    pr.category::text AS price_category,
    pr.renewal_interval_unit::text AS renewal_interval_unit,
    pr.renewal_interval_quantity,
    t.name AS tenant_name,
    t.slug AS tenant_slug,
    ts.logo_url AS tenant_logo_url,
    ts.icon_url AS tenant_icon_url,
    ts.primary_color AS tenant_primary_color,
    ts.theme_mode::text AS tenant_theme_mode,
    ts.checkout_use_brand_colors,
    ts.checkout_bg_color,
    ts.checkout_button_color,
    ts.checkout_button_style,
    ts.checkout_font_family
  FROM public.checkouts c
  JOIN public.tenants t ON t.id = c.tenant_id
  JOIN public.tenant_settings ts ON ts.tenant_id = t.id
  JOIN public.products p ON p.id = c.product_id
  JOIN public.prices pr ON pr.id = c.price_id
  WHERE c.smart_id = p_checkout_smart_id
    AND c.status = 'active'
    AND pr.is_active = true
    AND (c.expires_at IS NULL OR c.expires_at > now());
END;
$$;

-- ════════════════════════════════════════════════════════════
-- 9. ÍNDICE em zoop_seller_id (webhook Zoop busca por esse campo)
-- ════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_tenant_settings_zoop_seller_id
  ON public.tenant_settings (zoop_seller_id)
  WHERE zoop_seller_id IS NOT NULL;

-- ════════════════════════════════════════════════════════════
-- 10. RPC get_public_tenant_by_slug()
--     Retorna apenas campos públicos (branding/portal).
--     Usa SECURITY DEFINER para bypassar RLS restrita.
-- ════════════════════════════════════════════════════════════

DROP FUNCTION IF EXISTS public.get_public_tenant_by_slug(text);

CREATE OR REPLACE FUNCTION public.get_public_tenant_by_slug(
  p_slug text
)
RETURNS TABLE (
  id uuid,
  name text,
  slug text,
  description text,
  logo_url text,
  icon_url text,
  primary_color text,
  accent_color text,
  theme_mode text,
  hero_image_url text,
  portal_use_brand_colors boolean,
  portal_theme_mode text,
  portal_bg_image_url text,
  portal_button_color text,
  portal_button_style text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT
    t.id,
    t.name,
    t.slug,
    ts.description,
    ts.logo_url,
    ts.icon_url,
    ts.primary_color,
    ts.accent_color,
    ts.theme_mode,
    ts.hero_image_url,
    ts.portal_use_brand_colors,
    ts.portal_theme_mode,
    ts.portal_bg_image_url,
    ts.portal_button_color,
    ts.portal_button_style
  FROM public.tenants t
  JOIN public.tenant_settings ts ON ts.tenant_id = t.id
  WHERE t.slug = p_slug;
$$;
