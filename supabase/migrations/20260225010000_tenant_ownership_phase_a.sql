-- Phase A: decouple tenants from a single owner user_id
-- - add tenants.created_by for audit
-- - stop hard cascade from tenants.owner_id
-- - make tenant ownership source-of-truth in tenant_users
-- - block removal of the last owner
-- - provide ownership transfer RPC

-- 1) Audit column on tenants
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS created_by UUID NULL;

UPDATE public.tenants
SET created_by = COALESCE(created_by, owner_id)
WHERE created_by IS NULL;

ALTER TABLE public.tenants
  DROP CONSTRAINT IF EXISTS tenants_created_by_fkey;

ALTER TABLE public.tenants
  ADD CONSTRAINT tenants_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tenants_created_by ON public.tenants(created_by);

-- 2) Safety on legacy owner_id (keep column temporarily, remove risky cascade)
ALTER TABLE public.tenants
  ALTER COLUMN owner_id DROP NOT NULL;

ALTER TABLE public.tenants
  DROP CONSTRAINT IF EXISTS tenants_owner_id_fkey;

ALTER TABLE public.tenants
  ADD CONSTRAINT tenants_owner_id_fkey
  FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE SET NULL;

-- 3) tenant_users is internal team only (owner/editor)
ALTER TABLE public.tenant_users
  DROP CONSTRAINT IF EXISTS tenant_users_internal_roles_check;

ALTER TABLE public.tenant_users
  ADD CONSTRAINT tenant_users_internal_roles_check
  CHECK (role IN ('owner', 'editor'));

-- 4) Seed owner membership from created_by (fallback owner_id for compatibility)
CREATE OR REPLACE FUNCTION public.handle_new_tenant()
RETURNS TRIGGER AS $$
DECLARE
  v_owner_id uuid;
BEGIN
  v_owner_id := COALESCE(NEW.created_by, NEW.owner_id);

  IF v_owner_id IS NULL THEN
    RAISE EXCEPTION 'Tenant must define created_by or owner_id';
  END IF;

  INSERT INTO public.tenant_users (tenant_id, user_id, role)
  VALUES (NEW.id, v_owner_id, 'owner')
  ON CONFLICT (tenant_id, user_id) DO UPDATE
    SET role = 'owner';

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_tenant_created ON public.tenants;
CREATE TRIGGER on_tenant_created
  AFTER INSERT ON public.tenants
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_tenant();

-- 5) Guardrail: a tenant cannot lose its last owner
CREATE OR REPLACE FUNCTION public.ensure_tenant_has_owner()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id uuid;
BEGIN
  v_tenant_id := OLD.tenant_id;

  -- Allow cascades during tenant deletion.
  IF NOT EXISTS (SELECT 1 FROM public.tenants WHERE id = v_tenant_id) THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.tenant_users
    WHERE tenant_id = v_tenant_id
      AND role = 'owner'
  ) THEN
    RAISE EXCEPTION 'Tenant % must have at least one owner', v_tenant_id
      USING ERRCODE = '23514';
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.tenant_id IS DISTINCT FROM OLD.tenant_id THEN
    IF EXISTS (SELECT 1 FROM public.tenants WHERE id = NEW.tenant_id)
      AND NOT EXISTS (
        SELECT 1
        FROM public.tenant_users
        WHERE tenant_id = NEW.tenant_id
          AND role = 'owner'
      ) THEN
      RAISE EXCEPTION 'Tenant % must have at least one owner', NEW.tenant_id
        USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_tenant_users_require_owner ON public.tenant_users;
CREATE CONSTRAINT TRIGGER trg_tenant_users_require_owner
AFTER DELETE OR UPDATE ON public.tenant_users
DEFERRABLE INITIALLY IMMEDIATE
FOR EACH ROW EXECUTE FUNCTION public.ensure_tenant_has_owner();

-- 6) Policies on tenant_users: ownership can be transferred
DROP POLICY IF EXISTS "Users can view tenant users" ON public.tenant_users;
DROP POLICY IF EXISTS "Owners can add tenant users" ON public.tenant_users;
DROP POLICY IF EXISTS "Owners can update tenant users" ON public.tenant_users;
DROP POLICY IF EXISTS "Owners can remove tenant users" ON public.tenant_users;

CREATE POLICY "Editors can view tenant users"
  ON public.tenant_users FOR SELECT
  USING (public.is_tenant_editor(tenant_id) OR public.is_admin());

CREATE POLICY "Owners/admins can add tenant users"
  ON public.tenant_users FOR INSERT
  WITH CHECK (
    (public.is_tenant_owner(tenant_id) OR public.is_admin())
    AND role IN ('owner', 'editor')
    AND user_id <> auth.uid()
  );

CREATE POLICY "Owners/admins can update tenant users"
  ON public.tenant_users FOR UPDATE
  USING (public.is_tenant_owner(tenant_id) OR public.is_admin())
  WITH CHECK (
    (public.is_tenant_owner(tenant_id) OR public.is_admin())
    AND role IN ('owner', 'editor')
  );

CREATE POLICY "Owners/admins can remove tenant users"
  ON public.tenant_users FOR DELETE
  USING (public.is_tenant_owner(tenant_id) OR public.is_admin());

-- 7) Tenant create policy now uses created_by (legacy owner_id kept as fallback)
DROP POLICY IF EXISTS "Tenants can create tenants" ON public.tenants;
DROP POLICY IF EXISTS "Creators can create tenants" ON public.tenants;
DROP POLICY IF EXISTS "Sellers can create tenants" ON public.tenants;

CREATE POLICY "Tenants can create tenants"
  ON public.tenants FOR INSERT
  WITH CHECK (
    public.is_admin()
    OR (
      created_by = auth.uid()
      AND public.has_role(auth.uid(), 'tenant'::app_role)
    )
    OR (
      owner_id = auth.uid()
      AND public.has_role(auth.uid(), 'tenant'::app_role)
    )
  );

-- 8) Subscriptions visibility should follow tenant owner role (not owner_id column)
-- NOTE: subscriptions table only exists in deployments that have it; skip gracefully if absent.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'subscriptions'
  ) THEN
    DROP POLICY IF EXISTS "Tenant owner can view subscription" ON public.subscriptions;
    EXECUTE $pol$
      CREATE POLICY "Tenant owners can view subscription"
        ON public.subscriptions FOR SELECT
        USING (public.is_tenant_owner(tenant_id) OR public.is_admin())
    $pol$;
  END IF;
END $$;

-- 9) Ownership transfer RPC
CREATE OR REPLACE FUNCTION public.transfer_tenant_ownership(
  p_tenant_id uuid,
  p_new_owner_user_id uuid,
  p_demote_caller boolean DEFAULT true
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id uuid := auth.uid();
  v_is_admin boolean;
BEGIN
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT public.is_admin() INTO v_is_admin;

  IF NOT v_is_admin AND NOT public.is_tenant_owner(p_tenant_id) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  INSERT INTO public.tenant_users (tenant_id, user_id, role)
  VALUES (p_tenant_id, p_new_owner_user_id, 'owner')
  ON CONFLICT (tenant_id, user_id) DO UPDATE
    SET role = 'owner';

  IF p_demote_caller
     AND v_actor_id <> p_new_owner_user_id
     AND EXISTS (
       SELECT 1
       FROM public.tenant_users
       WHERE tenant_id = p_tenant_id
         AND user_id = v_actor_id
         AND role = 'owner'
     )
  THEN
    UPDATE public.tenant_users
    SET role = 'editor'
    WHERE tenant_id = p_tenant_id
      AND user_id = v_actor_id
      AND role = 'owner';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.transfer_tenant_ownership(uuid, uuid, boolean) TO authenticated;

-- 10) New users creating a tenant should fill created_by
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
  INSERT INTO public.profiles (user_id, name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'name', NEW.email));

  v_signup_as := COALESCE(NEW.raw_user_meta_data->>'signup_as', 'tenant');

  IF v_signup_as = 'customer' THEN
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

    INSERT INTO public.tenants (slug, name, created_by, owner_id)
    VALUES (v_tenant_slug, v_tenant_name, NEW.id, NEW.id)
    RETURNING id INTO v_tenant_id;

    INSERT INTO public.tenant_onboarding (user_id, tenant_id, current_step, is_completed)
    VALUES (NEW.id, v_tenant_id, 1, false)
    ON CONFLICT (user_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$function$;
