-- Cleanup: tenant_users roles are internal-only (owner/editor)
-- Replace enum tenant_role to remove legacy "customer" value.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.tenant_users
    WHERE role::text NOT IN ('owner', 'editor')
  ) THEN
    RAISE EXCEPTION 'tenant_users contains legacy roles outside owner/editor';
  END IF;
END $$;

DROP POLICY IF EXISTS "Editors can view tenant users" ON public.tenant_users;
DROP POLICY IF EXISTS "Owners/admins can add tenant users" ON public.tenant_users;
DROP POLICY IF EXISTS "Owners/admins can update tenant users" ON public.tenant_users;
DROP POLICY IF EXISTS "Owners/admins can remove tenant users" ON public.tenant_users;

ALTER TABLE public.tenant_users
  DROP CONSTRAINT IF EXISTS tenant_users_internal_roles_check;

ALTER TABLE public.tenant_users
  ALTER COLUMN role DROP DEFAULT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'tenant_role_v2'
  ) THEN
    CREATE TYPE public.tenant_role_v2 AS ENUM ('owner', 'editor');
  END IF;
END $$;

ALTER TABLE public.tenant_users
  ALTER COLUMN role TYPE public.tenant_role_v2
  USING role::text::public.tenant_role_v2;

ALTER TABLE public.tenant_users
  ALTER COLUMN role SET DEFAULT 'editor'::public.tenant_role_v2;

ALTER TYPE public.tenant_role RENAME TO tenant_role_legacy;
ALTER TYPE public.tenant_role_v2 RENAME TO tenant_role;
DROP TYPE public.tenant_role_legacy;

ALTER TABLE public.tenant_users
  ADD CONSTRAINT tenant_users_internal_roles_check
  CHECK (role IN ('owner', 'editor'));

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
