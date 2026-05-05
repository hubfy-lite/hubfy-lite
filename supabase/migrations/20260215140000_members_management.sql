-- ============================================================
-- Members Management: fields, indices, RPCs
-- ============================================================

-- 1. Add extra fields to tenant_users for member management
ALTER TABLE public.tenant_users
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS country text,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';

-- Add check constraint for status
ALTER TABLE public.tenant_users
  ADD CONSTRAINT tenant_users_status_check CHECK (status IN ('active', 'inactive'));

-- 2. Index for search (ILIKE on phone)
CREATE INDEX IF NOT EXISTS idx_tenant_users_phone
  ON public.tenant_users (tenant_id, phone)
  WHERE phone IS NOT NULL;

-- 3. RPC: get_tenant_members
-- Returns members with email (from auth.users) and profile data
-- Supports server-side search by name, email, or phone
CREATE OR REPLACE FUNCTION public.get_tenant_members(
  p_tenant_id uuid,
  p_search text DEFAULT NULL
)
RETURNS TABLE (
  user_id uuid,
  email text,
  name text,
  avatar_url text,
  phone text,
  country text,
  status text,
  role text,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Only allow if caller is a member of the tenant or admin
  IF NOT public.is_tenant_member(p_tenant_id) AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN QUERY
  SELECT
    tu.user_id,
    au.email::text,
    COALESCE(p.name, split_part(au.email::text, '@', 1)) as name,
    p.avatar_url,
    tu.phone,
    tu.country,
    tu.status,
    tu.role::text,
    tu.created_at
  FROM public.tenant_users tu
  JOIN auth.users au ON au.id = tu.user_id
  LEFT JOIN public.profiles p ON p.user_id = tu.user_id
  WHERE tu.tenant_id = p_tenant_id
    AND tu.role = 'member'
    AND (
      p_search IS NULL
      OR p_search = ''
      OR COALESCE(p.name, '') ILIKE '%' || p_search || '%'
      OR au.email::text ILIKE '%' || p_search || '%'
      OR COALESCE(tu.phone, '') ILIKE '%' || p_search || '%'
    )
  ORDER BY tu.created_at DESC;
END;
$$;

-- 4. RPC: update_tenant_member
-- Updates member fields (phone, country, status, name)
CREATE OR REPLACE FUNCTION public.update_tenant_member(
  p_tenant_id uuid,
  p_user_id uuid,
  p_name text DEFAULT NULL,
  p_phone text DEFAULT NULL,
  p_country text DEFAULT NULL,
  p_status text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Only owners can update members
  IF NOT public.is_tenant_owner(p_tenant_id) AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  -- Update tenant_users fields
  UPDATE public.tenant_users
  SET
    phone = COALESCE(p_phone, phone),
    country = COALESCE(p_country, country),
    status = COALESCE(p_status, status)
  WHERE tenant_id = p_tenant_id
    AND user_id = p_user_id
    AND role = 'member';

  -- Update profile name if provided
  IF p_name IS NOT NULL THEN
    UPDATE public.profiles
    SET name = p_name, updated_at = now()
    WHERE user_id = p_user_id;
  END IF;
END;
$$;

-- 5. RPC: delete_tenant_member
-- Removes a member from the tenant
CREATE OR REPLACE FUNCTION public.delete_tenant_member(
  p_tenant_id uuid,
  p_user_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Only owners can remove members
  IF NOT public.is_tenant_owner(p_tenant_id) AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  DELETE FROM public.tenant_users
  WHERE tenant_id = p_tenant_id
    AND user_id = p_user_id
    AND role = 'member';
END;
$$;
