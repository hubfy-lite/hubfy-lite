-- Rename tenant_members to tenant_users and update dependent objects

ALTER TABLE public.tenant_members RENAME TO tenant_users;

-- Rename indexes (if they exist)
ALTER INDEX IF EXISTS idx_tenant_members_tenant_id RENAME TO idx_tenant_users_tenant_id;
ALTER INDEX IF EXISTS idx_tenant_members_user_id RENAME TO idx_tenant_users_user_id;

-- Rename constraints (if they exist)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tenant_members_pkey') THEN
    ALTER TABLE public.tenant_users RENAME CONSTRAINT tenant_members_pkey TO tenant_users_pkey;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tenant_members_tenant_id_user_id_key') THEN
    ALTER TABLE public.tenant_users RENAME CONSTRAINT tenant_members_tenant_id_user_id_key TO tenant_users_tenant_id_user_id_key;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tenant_members_tenant_id_fkey') THEN
    ALTER TABLE public.tenant_users RENAME CONSTRAINT tenant_members_tenant_id_fkey TO tenant_users_tenant_id_fkey;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tenant_members_user_id_fkey') THEN
    ALTER TABLE public.tenant_users RENAME CONSTRAINT tenant_members_user_id_fkey TO tenant_users_user_id_fkey;
  END IF;
END $$;

-- Update helper functions to use tenant_users
CREATE OR REPLACE FUNCTION public.is_tenant_owner(_tenant_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tenant_users
    WHERE tenant_id = _tenant_id
      AND user_id = auth.uid()
      AND role = 'owner'
  )
$$;

CREATE OR REPLACE FUNCTION public.is_tenant_editor(_tenant_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tenant_users
    WHERE tenant_id = _tenant_id
      AND user_id = auth.uid()
      AND role IN ('owner', 'editor')
  )
$$;

CREATE OR REPLACE FUNCTION public.is_tenant_member(_tenant_id UUID)
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
$$;

-- Update trigger function to insert into tenant_users
CREATE OR REPLACE FUNCTION public.handle_new_tenant()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.tenant_users (tenant_id, user_id, role)
  VALUES (NEW.id, NEW.owner_id, 'owner');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Ensure RLS enabled
ALTER TABLE public.tenant_users ENABLE ROW LEVEL SECURITY;

-- Replace policies with tenant_users naming
DROP POLICY IF EXISTS "Members can view tenant members" ON public.tenant_users;
DROP POLICY IF EXISTS "Owners can add members" ON public.tenant_users;
DROP POLICY IF EXISTS "Owners can update members" ON public.tenant_users;
DROP POLICY IF EXISTS "Owners can remove members" ON public.tenant_users;

CREATE POLICY "Users can view tenant users"
  ON public.tenant_users FOR SELECT
  USING (public.is_tenant_member(tenant_id) OR public.is_admin());

CREATE POLICY "Owners can add tenant users"
  ON public.tenant_users FOR INSERT
  WITH CHECK (
    public.is_tenant_owner(tenant_id)
    AND role != 'owner'
    AND user_id != auth.uid()
  );

CREATE POLICY "Owners can update tenant users"
  ON public.tenant_users FOR UPDATE
  USING (public.is_tenant_owner(tenant_id) AND role != 'owner');

CREATE POLICY "Owners can remove tenant users"
  ON public.tenant_users FOR DELETE
  USING (public.is_tenant_owner(tenant_id) AND role != 'owner');
