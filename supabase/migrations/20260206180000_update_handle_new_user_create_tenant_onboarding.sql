-- Update handle_new_user to create profile, creator role, tenant, tenant_users, and creator_onboarding
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $function$
DECLARE
  v_tenant_id uuid;
  v_tenant_name text;
  v_tenant_slug text;
BEGIN
  -- Always create profile
  INSERT INTO public.profiles (user_id, name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'name', NEW.email));

  -- Ensure creator role for new users
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'creator')
  ON CONFLICT DO NOTHING;

  -- Create tenant with placeholder name/slug (to be updated during onboarding)
  v_tenant_name := COALESCE(
    NULLIF(NEW.raw_user_meta_data->>'community_name', ''),
    NULLIF(NEW.raw_user_meta_data->>'tenant_name', ''),
    NULLIF(NEW.raw_user_meta_data->>'name', ''),
    NULLIF(split_part(NEW.email, '@', 1), ''),
    'Nova comunidade'
  );

  v_tenant_slug := 'creator-' || NEW.id::text;

  INSERT INTO public.tenants (slug, name, owner_id)
  VALUES (v_tenant_slug, v_tenant_name, NEW.id)
  RETURNING id INTO v_tenant_id;

  -- Create onboarding row tied to the new tenant
  INSERT INTO public.creator_onboarding (user_id, tenant_id, current_step, is_completed)
  VALUES (NEW.id, v_tenant_id, 1, false)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$function$;
