
-- 1. Rename enum value 'creator' → 'tenant' in app_role
ALTER TYPE public.app_role RENAME VALUE 'creator' TO 'tenant';

-- 2. Rename table creator_onboarding → tenant_onboarding
ALTER TABLE public.creator_onboarding RENAME TO tenant_onboarding;

-- 3. Rename columns community_name → tenant_name, community_slug → tenant_slug
ALTER TABLE public.tenant_onboarding RENAME COLUMN community_name TO tenant_name;
ALTER TABLE public.tenant_onboarding RENAME COLUMN community_slug TO tenant_slug;

-- 4. Update handle_new_user() to use 'tenant' role and tenant_onboarding table
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_tenant_id uuid;
  v_tenant_name text;
  v_tenant_slug text;
BEGIN
  -- Always create profile
  INSERT INTO public.profiles (user_id, name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'name', NEW.email));

  -- Ensure tenant role for new users
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'tenant')
  ON CONFLICT DO NOTHING;

  -- Create tenant with placeholder name/slug (to be updated during onboarding)
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

  -- Create onboarding row tied to the new tenant
  INSERT INTO public.tenant_onboarding (user_id, tenant_id, current_step, is_completed)
  VALUES (NEW.id, v_tenant_id, 1, false)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$function$;

-- 5. Update tenants INSERT policy to use 'tenant' role
DROP POLICY IF EXISTS "Creators can create tenants" ON public.tenants;
CREATE POLICY "Tenants can create tenants" ON public.tenants
  FOR INSERT
  WITH CHECK ((owner_id = auth.uid()) AND has_role(auth.uid(), 'tenant'::app_role));
