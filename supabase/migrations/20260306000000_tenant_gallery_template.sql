ALTER TABLE public.tenant_settings
  ADD COLUMN IF NOT EXISTS portal_products_template text NOT NULL DEFAULT 'gallery_01';
