-- ============================================================
-- Migration: Products, Prices, Checkouts, Orders
--
-- Creates the commerce layer for Hubfy:
-- - products: what the tenant sells
-- - product_showcases / product_assets: what a product delivers
-- - prices: how much it costs (v1: always 0 / free)
-- - checkouts: capture pages for products
-- - orders: purchase records
-- ============================================================

-- ============================================================
-- 1. ENUMS
-- ============================================================

DO $$ BEGIN
  CREATE TYPE public.product_status AS ENUM ('draft', 'published', 'archived');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.price_type AS ENUM ('one_time', 'recurring');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.checkout_status AS ENUM ('draft', 'active', 'inactive');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.order_status AS ENUM ('pending', 'completed', 'refunded', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- 2. TABLES
-- ============================================================

-- products — what the tenant sells
CREATE TABLE IF NOT EXISTS public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

  slug TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  cover_url TEXT,

  status public.product_status NOT NULL DEFAULT 'draft',

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(tenant_id, slug)
);

-- product_showcases — which showcases a product delivers access to
CREATE TABLE IF NOT EXISTS public.product_showcases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  showcase_id UUID NOT NULL REFERENCES public.showcases(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(product_id, showcase_id)
);

-- product_assets — which assets a product delivers directly (ebooks, docs)
CREATE TABLE IF NOT EXISTS public.product_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  asset_id UUID NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(product_id, asset_id)
);

-- prices — how much a product costs
CREATE TABLE IF NOT EXISTS public.prices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,

  type public.price_type NOT NULL DEFAULT 'one_time',
  amount_cents INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'BRL',

  -- v2: recurring fields (commented for now)
  -- billing_interval TEXT,          -- 'month', 'year'
  -- billing_interval_count INTEGER, -- 1, 3, 6, 12
  -- trial_days INTEGER,

  is_active BOOLEAN NOT NULL DEFAULT true,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- checkouts — capture pages / links
CREATE TABLE IF NOT EXISTS public.checkouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  price_id UUID NOT NULL REFERENCES public.prices(id) ON DELETE CASCADE,

  slug TEXT NOT NULL,
  title TEXT,
  description TEXT,

  status public.checkout_status NOT NULL DEFAULT 'draft',

  -- which fields the checkout collects (name + email are always required)
  collect_phone BOOLEAN NOT NULL DEFAULT false,
  collect_address BOOLEAN NOT NULL DEFAULT false,

  -- v2: customization
  -- thank_you_message TEXT,
  -- redirect_url TEXT,
  -- custom_fields JSONB,

  -- v2: payment provider
  -- payment_provider TEXT,
  -- payment_provider_config JSONB,

  -- metrics
  total_orders INTEGER NOT NULL DEFAULT 0,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(tenant_id, slug)
);

-- orders — purchase records
CREATE TABLE IF NOT EXISTS public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  checkout_id UUID REFERENCES public.checkouts(id) ON DELETE SET NULL,
  price_id UUID REFERENCES public.prices(id) ON DELETE SET NULL,

  status public.order_status NOT NULL DEFAULT 'completed',

  amount_cents INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'BRL',

  -- v2: payment tracking
  -- payment_provider TEXT,
  -- payment_provider_id TEXT,
  -- paid_at TIMESTAMPTZ,
  -- refunded_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- 3. INDEXES
-- ============================================================

-- products
CREATE INDEX IF NOT EXISTS idx_products_tenant ON public.products(tenant_id);
CREATE INDEX IF NOT EXISTS idx_products_status ON public.products(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_products_name_trgm
  ON public.products USING gin (name gin_trgm_ops);

-- product_showcases
CREATE INDEX IF NOT EXISTS idx_product_showcases_product ON public.product_showcases(product_id);
CREATE INDEX IF NOT EXISTS idx_product_showcases_showcase ON public.product_showcases(showcase_id);

-- product_assets
CREATE INDEX IF NOT EXISTS idx_product_assets_product ON public.product_assets(product_id);
CREATE INDEX IF NOT EXISTS idx_product_assets_asset ON public.product_assets(asset_id);

-- prices
CREATE INDEX IF NOT EXISTS idx_prices_product ON public.prices(product_id);

-- checkouts
CREATE INDEX IF NOT EXISTS idx_checkouts_tenant ON public.checkouts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_checkouts_product ON public.checkouts(product_id);
CREATE INDEX IF NOT EXISTS idx_checkouts_slug ON public.checkouts(tenant_id, slug);

-- orders
CREATE INDEX IF NOT EXISTS idx_orders_tenant ON public.orders(tenant_id);
CREATE INDEX IF NOT EXISTS idx_orders_customer ON public.orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_product ON public.orders(product_id);
CREATE INDEX IF NOT EXISTS idx_orders_checkout ON public.orders(checkout_id) WHERE checkout_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_created ON public.orders(tenant_id, created_at DESC);

-- ============================================================
-- 4. TRIGGERS (updated_at)
-- ============================================================

CREATE TRIGGER set_products_updated_at BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_prices_updated_at BEFORE UPDATE ON public.prices
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_checkouts_updated_at BEFORE UPDATE ON public.checkouts
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_orders_updated_at BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================
-- 5. HELPER FUNCTIONS
-- ============================================================

-- get_product_tenant: returns the tenant_id for a product (used by RLS and validation)
CREATE OR REPLACE FUNCTION public.get_product_tenant(_product_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT tenant_id FROM public.products WHERE id = _product_id
$$;

-- ============================================================
-- 6. VALIDATION TRIGGERS
-- ============================================================

-- Ensure product and showcase belong to the same tenant
CREATE OR REPLACE FUNCTION public.validate_product_showcase_tenant()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_product_tenant UUID;
  v_showcase_tenant UUID;
BEGIN
  SELECT tenant_id INTO v_product_tenant FROM public.products WHERE id = NEW.product_id;
  SELECT tenant_id INTO v_showcase_tenant FROM public.showcases WHERE id = NEW.showcase_id;

  IF v_product_tenant IS DISTINCT FROM v_showcase_tenant THEN
    RAISE EXCEPTION 'Product and showcase must belong to the same tenant';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_product_showcase_tenant
  BEFORE INSERT OR UPDATE ON public.product_showcases
  FOR EACH ROW EXECUTE FUNCTION public.validate_product_showcase_tenant();

-- Ensure product and asset belong to the same tenant
CREATE OR REPLACE FUNCTION public.validate_product_asset_tenant()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_product_tenant UUID;
  v_asset_tenant UUID;
BEGIN
  SELECT tenant_id INTO v_product_tenant FROM public.products WHERE id = NEW.product_id;
  SELECT tenant_id INTO v_asset_tenant FROM public.assets WHERE id = NEW.asset_id;

  IF v_product_tenant IS DISTINCT FROM v_asset_tenant THEN
    RAISE EXCEPTION 'Product and asset must belong to the same tenant';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_product_asset_tenant
  BEFORE INSERT OR UPDATE ON public.product_assets
  FOR EACH ROW EXECUTE FUNCTION public.validate_product_asset_tenant();

-- ============================================================
-- 7. RLS POLICIES
-- ============================================================

-- products
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Editors can manage products"
  ON public.products FOR ALL
  USING (public.is_tenant_editor(tenant_id) OR public.is_admin());

CREATE POLICY "Published products are viewable by tenant customers"
  ON public.products FOR SELECT
  USING (status = 'published' AND public.is_tenant_customer(tenant_id));

-- product_showcases
ALTER TABLE public.product_showcases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Editors can manage product_showcases"
  ON public.product_showcases FOR ALL
  USING (
    public.is_tenant_editor(public.get_product_tenant(product_id))
    OR public.is_admin()
  );

CREATE POLICY "Customers can view product_showcases"
  ON public.product_showcases FOR SELECT
  USING (
    public.is_tenant_customer(public.get_product_tenant(product_id))
  );

-- product_assets
ALTER TABLE public.product_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Editors can manage product_assets"
  ON public.product_assets FOR ALL
  USING (
    public.is_tenant_editor(public.get_product_tenant(product_id))
    OR public.is_admin()
  );

CREATE POLICY "Customers can view product_assets"
  ON public.product_assets FOR SELECT
  USING (
    public.is_tenant_customer(public.get_product_tenant(product_id))
  );

-- prices
ALTER TABLE public.prices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Editors can manage prices"
  ON public.prices FOR ALL
  USING (
    public.is_tenant_editor(public.get_product_tenant(product_id))
    OR public.is_admin()
  );

CREATE POLICY "Active prices are viewable by tenant customers"
  ON public.prices FOR SELECT
  USING (
    is_active = true
    AND public.is_tenant_customer(public.get_product_tenant(product_id))
  );

-- checkouts
ALTER TABLE public.checkouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Editors can manage checkouts"
  ON public.checkouts FOR ALL
  USING (public.is_tenant_editor(tenant_id) OR public.is_admin());

-- Note: active checkouts are accessed publicly via edge function, not via RLS

-- orders
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Editors can manage orders"
  ON public.orders FOR ALL
  USING (public.is_tenant_editor(tenant_id) OR public.is_admin());

CREATE POLICY "Customers can view own orders"
  ON public.orders FOR SELECT
  USING (
    customer_id IN (SELECT id FROM public.customers WHERE user_id = auth.uid())
  );

-- ============================================================
-- 8. UPDATE global_search RPC
-- ============================================================

CREATE OR REPLACE FUNCTION public.global_search(
  p_tenant_id uuid,
  p_query text
)
RETURNS TABLE (
  category text,
  id uuid,
  title text,
  subtitle text,
  url text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_query text;
BEGIN
  IF NOT public.is_tenant_customer(p_tenant_id) AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  v_query := trim(p_query);
  IF v_query = '' THEN
    RETURN;
  END IF;

  RETURN QUERY

  -- Courses
  (SELECT
    'course'::text AS cat,
    c.id,
    c.title,
    CASE WHEN c.is_published THEN 'Publicado' ELSE 'Rascunho' END AS subtitle,
    '/admin/courses/' || c.id::text AS url
  FROM public.courses c
  WHERE c.tenant_id = p_tenant_id
    AND c.title ILIKE '%' || v_query || '%'
  ORDER BY similarity(c.title, v_query) DESC
  LIMIT 5)

  UNION ALL

  -- Products
  (SELECT
    'product'::text AS cat,
    pr.id,
    pr.name AS title,
    pr.status::text AS subtitle,
    '/admin/products' AS url
  FROM public.products pr
  WHERE pr.tenant_id = p_tenant_id
    AND pr.name ILIKE '%' || v_query || '%'
  ORDER BY similarity(pr.name, v_query) DESC
  LIMIT 5)

  UNION ALL

  -- Showcases
  (SELECT
    'showcase'::text AS cat,
    s.id,
    s.title,
    CASE WHEN s.is_public THEN 'Pública' ELSE 'Privada' END AS subtitle,
    '/admin/showcase' AS url
  FROM public.showcases s
  WHERE s.tenant_id = p_tenant_id
    AND s.title ILIKE '%' || v_query || '%'
  ORDER BY similarity(s.title, v_query) DESC
  LIMIT 5)

  UNION ALL

  -- Assets
  (SELECT
    'asset'::text AS cat,
    a.id,
    a.title,
    a.type::text AS subtitle,
    '/admin/assets' AS url
  FROM public.assets a
  WHERE a.tenant_id = p_tenant_id
    AND a.status <> 'deleted'
    AND a.title ILIKE '%' || v_query || '%'
  ORDER BY similarity(a.title, v_query) DESC
  LIMIT 5)

  UNION ALL

  -- Customers
  (SELECT
    'customer'::text AS cat,
    cu.id,
    COALESCE(cu.name, split_part(cu.email, '@', 1)) AS title,
    cu.email AS subtitle,
    '/admin/customers' AS url
  FROM public.customers cu
  WHERE cu.tenant_id = p_tenant_id
    AND (
      COALESCE(cu.name, '') ILIKE '%' || v_query || '%'
      OR cu.email ILIKE '%' || v_query || '%'
    )
  ORDER BY similarity(COALESCE(cu.name, cu.email), v_query) DESC
  LIMIT 5);
END;
$$;
