-- Team invite support: RPC to list members, trigger update for team_member signup, status defaults

-- 1) Default status on tenant_users
ALTER TABLE public.tenant_users ALTER COLUMN status SET DEFAULT 'active';
UPDATE public.tenant_users SET status = 'active' WHERE status IS NULL;

-- 2) RPC to list team members (joins auth.users for email)
CREATE OR REPLACE FUNCTION public.get_team_members(p_tenant_id uuid)
RETURNS TABLE (
  user_id uuid,
  email text,
  name text,
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

GRANT EXECUTE ON FUNCTION public.get_team_members(uuid) TO authenticated;

-- 3) Update handle_new_user to support team_member signup type
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

  ELSIF v_signup_as = 'team_member' THEN
    -- Team member: gets tenant role but does NOT create a new tenant or onboarding
    v_team_member_tenant_id := (NEW.raw_user_meta_data->>'team_member_tenant_id')::uuid;

    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'tenant')
    ON CONFLICT DO NOTHING;

    -- Insert into tenant_users with editor role and active status
    IF v_team_member_tenant_id IS NOT NULL THEN
      INSERT INTO public.tenant_users (tenant_id, user_id, role, status)
      VALUES (v_team_member_tenant_id, NEW.id, 'editor', 'active')
      ON CONFLICT (tenant_id, user_id) DO UPDATE SET status = 'active';
    END IF;

  ELSE
    -- Default: regular tenant signup — creates new tenant + onboarding
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

    INSERT INTO public.tenants (slug, name, created_by)
    VALUES (v_tenant_slug, v_tenant_name, NEW.id)
    RETURNING id INTO v_tenant_id;

    INSERT INTO public.tenant_onboarding (user_id, tenant_id, current_step, is_completed)
    VALUES (NEW.id, v_tenant_id, 1, false)
    ON CONFLICT (user_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$function$;
