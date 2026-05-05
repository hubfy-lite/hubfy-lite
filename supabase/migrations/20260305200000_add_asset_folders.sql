-- Asset folders: flat (single-level) folder organization for assets

CREATE TABLE public.asset_folders (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name       TEXT        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT asset_folders_unique_name UNIQUE (tenant_id, name)
);

-- Link assets to folders (nullable = asset has no folder)
ALTER TABLE public.assets
  ADD COLUMN folder_id UUID REFERENCES public.asset_folders(id) ON DELETE SET NULL;

-- Indexes
CREATE INDEX idx_asset_folders_tenant_id ON public.asset_folders(tenant_id);
CREATE INDEX idx_assets_folder_id ON public.assets(folder_id);

-- RLS
ALTER TABLE public.asset_folders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Editors can view tenant folders"
  ON public.asset_folders FOR SELECT
  USING (is_tenant_editor(tenant_id) OR is_admin());

CREATE POLICY "Editors can create tenant folders"
  ON public.asset_folders FOR INSERT
  WITH CHECK (is_tenant_editor(tenant_id));

CREATE POLICY "Editors can update tenant folders"
  ON public.asset_folders FOR UPDATE
  USING (is_tenant_editor(tenant_id) OR is_admin());

CREATE POLICY "Owners can delete tenant folders"
  ON public.asset_folders FOR DELETE
  USING (is_tenant_owner(tenant_id) OR is_admin());
