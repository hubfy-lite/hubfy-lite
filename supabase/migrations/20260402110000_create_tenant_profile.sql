-- ============================================================
-- Create tenant_profile table
-- Separates business profile / onboarding data from tenant_settings
-- ============================================================

-- 1. Create table
CREATE TABLE IF NOT EXISTS public.tenant_profile (
  tenant_id uuid PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
  country text DEFAULT NULL,
  referral_source text DEFAULT NULL,
  role_tags jsonb DEFAULT NULL,
  used_tools jsonb DEFAULT NULL,
  onboarding_goal text DEFAULT NULL,
  customer_count text DEFAULT NULL,
  annual_revenue text DEFAULT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.tenant_profile IS 'Business profile and onboarding survey data for each tenant';
COMMENT ON COLUMN public.tenant_profile.onboarding_goal IS 'start_fresh | migrate | exploring';
COMMENT ON COLUMN public.tenant_profile.customer_count IS 'over_5000 | 1000_5000 | 100_1000 | 1_100 | none';
COMMENT ON COLUMN public.tenant_profile.annual_revenue IS 'over_10m | 1m_10m | 250k_1m | 100k_250k | 50k_100k | under_50k';
COMMENT ON COLUMN public.tenant_profile.used_tools IS 'JSON array of tool/platform names selected during onboarding';
COMMENT ON COLUMN public.tenant_profile.role_tags IS 'JSON array of business role tags (e.g. Infoprodutor, Coach)';

-- 2. Migrate existing data from tenant_settings
INSERT INTO public.tenant_profile (tenant_id, country, referral_source, role_tags)
SELECT tenant_id, country, referral_source, role_tags
FROM public.tenant_settings
WHERE country IS NOT NULL
   OR referral_source IS NOT NULL
   OR role_tags IS NOT NULL
ON CONFLICT (tenant_id) DO NOTHING;

-- 3. Ensure every tenant has a profile row (even if all nulls)
INSERT INTO public.tenant_profile (tenant_id)
SELECT id FROM public.tenants
ON CONFLICT (tenant_id) DO NOTHING;

-- 4. Drop migrated columns from tenant_settings
ALTER TABLE public.tenant_settings
  DROP COLUMN IF EXISTS country,
  DROP COLUMN IF EXISTS referral_source,
  DROP COLUMN IF EXISTS role_tags;

-- 5. RLS
ALTER TABLE public.tenant_profile ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_profile_select_member"
  ON public.tenant_profile FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.tenant_users tu
      WHERE tu.tenant_id = tenant_profile.tenant_id
        AND tu.user_id = auth.uid()
    )
  );

CREATE POLICY "tenant_profile_insert_owner"
  ON public.tenant_profile FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tenant_users tu
      WHERE tu.tenant_id = tenant_profile.tenant_id
        AND tu.user_id = auth.uid()
        AND tu.role = 'owner'
    )
  );

CREATE POLICY "tenant_profile_update_member"
  ON public.tenant_profile FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.tenant_users tu
      WHERE tu.tenant_id = tenant_profile.tenant_id
        AND tu.user_id = auth.uid()
        AND tu.role IN ('owner', 'editor')
    )
  );

-- 6. Auto updated_at
CREATE TRIGGER set_tenant_profile_updated_at
  BEFORE UPDATE ON public.tenant_profile
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- 7. Update handle_new_tenant() to also create tenant_profile row
CREATE OR REPLACE FUNCTION public.handle_new_tenant()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.created_by IS NULL THEN
    RAISE EXCEPTION 'Tenant must define created_by';
  END IF;

  -- Auto-add creator as owner
  INSERT INTO public.tenant_users (tenant_id, user_id, role)
  VALUES (NEW.id, NEW.created_by, 'owner')
  ON CONFLICT (tenant_id, user_id) DO UPDATE
    SET role = 'owner';

  -- Create tenant_settings with defaults
  INSERT INTO public.tenant_settings (tenant_id)
  VALUES (NEW.id)
  ON CONFLICT (tenant_id) DO NOTHING;

  -- Create tenant_profile with defaults
  INSERT INTO public.tenant_profile (tenant_id)
  VALUES (NEW.id)
  ON CONFLICT (tenant_id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
