-- Phase B: remove tenants.owner_id and legacy fallbacks

-- 1) Ensure created_by is best-effort populated from current owner membership
UPDATE public.tenants t
SET created_by = (
  SELECT tu.user_id
  FROM public.tenant_users tu
  WHERE tu.tenant_id = t.id
    AND tu.role = 'owner'
  ORDER BY tu.created_at ASC
  LIMIT 1
)
WHERE t.created_by IS NULL;

-- 2) Remove legacy owner_id dependency from tenant creation flow
CREATE OR REPLACE FUNCTION public.handle_new_tenant()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.created_by IS NULL THEN
    RAISE EXCEPTION 'Tenant must define created_by';
  END IF;

  INSERT INTO public.tenant_users (tenant_id, user_id, role)
  VALUES (NEW.id, NEW.created_by, 'owner')
  ON CONFLICT (tenant_id, user_id) DO UPDATE
    SET role = 'owner';

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 3) Keep insert policy aligned with created_by-only model
DROP POLICY IF EXISTS "Tenants can create tenants" ON public.tenants;
CREATE POLICY "Tenants can create tenants"
  ON public.tenants FOR INSERT
  WITH CHECK (
    public.is_admin()
    OR (
      created_by = auth.uid()
      AND public.has_role(auth.uid(), 'tenant'::app_role)
    )
  );

-- 4) Update signup trigger to insert tenant without owner_id
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

-- 5) Drop owner_id storage + supporting FK/index
DROP INDEX IF EXISTS public.idx_tenants_owner_id;

ALTER TABLE public.tenants
  DROP CONSTRAINT IF EXISTS tenants_owner_id_fkey;

ALTER TABLE public.tenants
  DROP COLUMN IF EXISTS owner_id;
