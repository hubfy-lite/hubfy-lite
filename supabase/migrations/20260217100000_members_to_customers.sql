-- ============================================================
-- Migration: Members → Customers
--
-- Creates dedicated `customers` table, renames enums,
-- updates RPCs, trigger, and separates customer concept
-- from tenant_users (which keeps only owner/editor).
-- ============================================================

-- 1. Create email_marketing_status enum
DO $$ BEGIN
  CREATE TYPE public.email_marketing_status AS ENUM (
    'subscribed',
    'unsubscribed',
    'archived',
    'requires_verification',
    'invalid_email',
    'bounced'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2. Create customers table
CREATE TABLE IF NOT EXISTS public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- contact (denormalized from profiles for tenant autonomy)
  name TEXT,
  email TEXT NOT NULL,
  phone TEXT,

  -- location
  city TEXT,
  region TEXT,
  country TEXT,

  -- email marketing
  email_marketing_status public.email_marketing_status NOT NULL DEFAULT 'subscribed',

  -- financial metrics (filled via webhook/trigger later)
  total_revenue_cents INTEGER NOT NULL DEFAULT 0,
  mrr_cents INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'BRL',

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(tenant_id, user_id),
  UNIQUE(tenant_id, email)
);

-- 3. Indexes
CREATE INDEX IF NOT EXISTS idx_customers_tenant ON public.customers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_customers_email ON public.customers(tenant_id, email);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON public.customers(tenant_id, phone) WHERE phone IS NOT NULL;

-- Trigram indexes for global_search
CREATE INDEX IF NOT EXISTS idx_customers_name_trgm
  ON public.customers USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_customers_email_trgm
  ON public.customers USING gin (email gin_trgm_ops);

-- 4. Trigger for updated_at
CREATE TRIGGER set_customers_updated_at BEFORE UPDATE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 5. RLS
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners/editors can manage customers"
  ON public.customers FOR ALL
  USING (
    public.is_tenant_editor(tenant_id) OR public.is_admin()
  );

CREATE POLICY "Customers can view own record"
  ON public.customers FOR SELECT
  USING (user_id = auth.uid());

-- 6. Rename enum values: member → customer
ALTER TYPE public.app_role RENAME VALUE 'member' TO 'customer';
ALTER TYPE public.tenant_role RENAME VALUE 'member' TO 'customer';

-- 7. Drop old constraint from tenant_users (was added in members_management migration)
ALTER TABLE public.tenant_users DROP CONSTRAINT IF EXISTS tenant_users_status_check;

-- 8. Migrate existing tenant_users with role='customer' (previously 'member', now renamed) to customers table
INSERT INTO public.customers (tenant_id, user_id, name, email, phone, country, created_at)
SELECT
  tu.tenant_id,
  tu.user_id,
  COALESCE(p.name, split_part(au.email::text, '@', 1)),
  au.email::text,
  tu.phone,
  tu.country,
  tu.created_at
FROM public.tenant_users tu
JOIN auth.users au ON au.id = tu.user_id
LEFT JOIN public.profiles p ON p.user_id = tu.user_id
WHERE tu.role = 'customer'
ON CONFLICT (tenant_id, user_id) DO NOTHING;

-- 9. Remove migrated customer rows from tenant_users
-- They now live in the customers table
DELETE FROM public.tenant_users WHERE role = 'customer';

-- 10. Rename is_tenant_member → is_tenant_customer
-- This function checks if the current user belongs to a tenant (as owner, editor, OR customer)
CREATE OR REPLACE FUNCTION public.is_tenant_customer(_tenant_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tenant_users
    WHERE tenant_id = _tenant_id AND user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.customers
    WHERE tenant_id = _tenant_id AND user_id = auth.uid()
  )
$$;

-- Keep is_tenant_member as alias for backward compatibility with existing policies
CREATE OR REPLACE FUNCTION public.is_tenant_member(_tenant_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_tenant_customer(_tenant_id)
$$;

-- 11. Rename showcase_members → showcase_customers
ALTER TABLE IF EXISTS public.showcase_members RENAME TO showcase_customers;
ALTER INDEX IF EXISTS idx_showcase_members_showcase_id RENAME TO idx_showcase_customers_showcase_id;

-- 12. Drop old member RPCs
DROP FUNCTION IF EXISTS public.get_tenant_members(uuid, text);
DROP FUNCTION IF EXISTS public.update_tenant_member(uuid, uuid, text, text, text, text);
DROP FUNCTION IF EXISTS public.delete_tenant_member(uuid, uuid);

-- 13. RPC: get_tenant_customers
-- Returns customers for a tenant with server-side search
CREATE OR REPLACE FUNCTION public.get_tenant_customers(
  p_tenant_id uuid,
  p_search text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  email text,
  name text,
  avatar_url text,
  phone text,
  city text,
  region text,
  country text,
  email_marketing_status text,
  total_revenue_cents integer,
  mrr_cents integer,
  currency text,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Only allow if caller is part of the tenant or admin
  IF NOT public.is_tenant_customer(p_tenant_id) AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN QUERY
  SELECT
    c.id,
    c.user_id,
    c.email,
    COALESCE(c.name, p.name, split_part(c.email, '@', 1)) as name,
    p.avatar_url,
    c.phone,
    c.city,
    c.region,
    c.country,
    c.email_marketing_status::text,
    c.total_revenue_cents,
    c.mrr_cents,
    c.currency,
    c.created_at,
    c.updated_at
  FROM public.customers c
  LEFT JOIN public.profiles p ON p.user_id = c.user_id
  WHERE c.tenant_id = p_tenant_id
    AND (
      p_search IS NULL
      OR p_search = ''
      OR COALESCE(c.name, '') ILIKE '%' || p_search || '%'
      OR c.email ILIKE '%' || p_search || '%'
      OR COALESCE(c.phone, '') ILIKE '%' || p_search || '%'
    )
  ORDER BY c.created_at DESC;
END;
$$;

-- 14. RPC: update_tenant_customer
CREATE OR REPLACE FUNCTION public.update_tenant_customer(
  p_tenant_id uuid,
  p_user_id uuid,
  p_name text DEFAULT NULL,
  p_phone text DEFAULT NULL,
  p_city text DEFAULT NULL,
  p_region text DEFAULT NULL,
  p_country text DEFAULT NULL,
  p_email_marketing_status text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Only owners/editors can update customers
  IF NOT public.is_tenant_editor(p_tenant_id) AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE public.customers
  SET
    name = COALESCE(p_name, name),
    phone = COALESCE(p_phone, phone),
    city = COALESCE(p_city, city),
    region = COALESCE(p_region, region),
    country = COALESCE(p_country, country),
    email_marketing_status = COALESCE(p_email_marketing_status::email_marketing_status, email_marketing_status),
    updated_at = now()
  WHERE tenant_id = p_tenant_id
    AND user_id = p_user_id;

  -- Also update profile name if provided
  IF p_name IS NOT NULL THEN
    UPDATE public.profiles
    SET name = p_name, updated_at = now()
    WHERE user_id = p_user_id;
  END IF;
END;
$$;

-- 15. RPC: delete_tenant_customer
CREATE OR REPLACE FUNCTION public.delete_tenant_customer(
  p_tenant_id uuid,
  p_user_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Only owners/editors can remove customers
  IF NOT public.is_tenant_editor(p_tenant_id) AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  DELETE FROM public.customers
  WHERE tenant_id = p_tenant_id
    AND user_id = p_user_id;
END;
$$;

-- 16. Update handle_new_user trigger
-- Now: signup_as = 'customer' inserts into customers table (not tenant_users)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  v_signup_as text;
  v_customer_tenant_id uuid;
  v_tenant_id uuid;
  v_tenant_name text;
  v_tenant_slug text;
BEGIN
  -- Always create profile
  INSERT INTO public.profiles (user_id, name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'name', NEW.email));

  v_signup_as := COALESCE(NEW.raw_user_meta_data->>'signup_as', 'tenant');

  IF v_signup_as = 'customer' THEN
    -- Customer signup: assign customer role and add to customers table
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

  ELSE
    -- Tenant signup (default behavior)
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'tenant')
    ON CONFLICT DO NOTHING;

    v_tenant_name := COALESCE(
      NULLIF(NEW.raw_user_meta_data->>'tenant_name', ''),
      NULLIF(NEW.raw_user_meta_data->>'name', ''),
      NULLIF(split_part(NEW.email, '@', 1), ''),
      'Novo workspace'
    );

    v_tenant_slug := 'tenant-' || NEW.id::text;

    INSERT INTO public.tenants (slug, name, owner_id)
    VALUES (v_tenant_slug, v_tenant_name, NEW.id)
    RETURNING id INTO v_tenant_id;

    INSERT INTO public.tenant_onboarding (user_id, tenant_id, current_step, is_completed)
    VALUES (NEW.id, v_tenant_id, 1, false)
    ON CONFLICT (user_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$function$;

-- 17. Drop old indexes from tenant_users that were for member management
DROP INDEX IF EXISTS idx_tenant_users_phone;

-- 18. Update global_search RPC to query customers table instead of tenant_users
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
  -- Must be a member of the tenant or admin
  IF NOT public.is_tenant_customer(p_tenant_id) AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  -- Normalize query
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

  -- Customers (from customers table)
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
