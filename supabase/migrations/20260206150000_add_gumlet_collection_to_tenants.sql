-- Add Gumlet collection id per tenant
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS gumlet_collection_id TEXT;

CREATE INDEX IF NOT EXISTS idx_tenants_gumlet_collection_id
  ON public.tenants(gumlet_collection_id);
