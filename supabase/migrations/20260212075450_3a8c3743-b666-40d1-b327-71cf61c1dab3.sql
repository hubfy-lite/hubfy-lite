
-- Update handle_new_user to support member signup via OTP
-- When signup_as = 'member' and member_tenant_id is provided in metadata,
-- assign 'member' role and add to tenant_users instead of creating a new tenant.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  v_signup_as text;
  v_member_tenant_id uuid;
  v_tenant_id uuid;
  v_tenant_name text;
  v_tenant_slug text;
BEGIN
  -- Always create profile
  INSERT INTO public.profiles (user_id, name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'name', NEW.email));

  v_signup_as := COALESCE(NEW.raw_user_meta_data->>'signup_as', 'tenant');

  IF v_signup_as = 'member' THEN
    -- Member signup: assign member role and link to tenant
    v_member_tenant_id := (NEW.raw_user_meta_data->>'member_tenant_id')::uuid;

    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'member')
    ON CONFLICT DO NOTHING;

    IF v_member_tenant_id IS NOT NULL THEN
      INSERT INTO public.tenant_users (tenant_id, user_id, role)
      VALUES (v_member_tenant_id, NEW.id, 'member')
      ON CONFLICT DO NOTHING;
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
      'Nova comunidade'
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
