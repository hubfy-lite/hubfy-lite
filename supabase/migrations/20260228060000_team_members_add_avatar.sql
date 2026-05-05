-- Add avatar_url to get_team_members RPC (must drop first to change return type)
DROP FUNCTION IF EXISTS public.get_team_members(uuid);
CREATE OR REPLACE FUNCTION public.get_team_members(p_tenant_id uuid)
RETURNS TABLE (
  user_id uuid,
  email text,
  name text,
  avatar_url text,
  role text,
  status text,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (public.is_tenant_editor(p_tenant_id) OR public.is_admin()) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN QUERY
  SELECT
    tu.user_id,
    au.email::text,
    COALESCE(p.name, au.email)::text AS name,
    p.avatar_url::text,
    tu.role::text,
    COALESCE(tu.status, 'active')::text AS status,
    tu.created_at
  FROM public.tenant_users tu
  JOIN auth.users au ON au.id = tu.user_id
  LEFT JOIN public.profiles p ON p.user_id = tu.user_id
  WHERE tu.tenant_id = p_tenant_id
  ORDER BY
    CASE tu.role WHEN 'owner' THEN 0 ELSE 1 END,
    tu.created_at ASC;
END;
$$;
