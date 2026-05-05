
-- Add visual customization fields to tenants
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS primary_color text DEFAULT '#6366f1',
  ADD COLUMN IF NOT EXISTS accent_color text DEFAULT '#f59e0b',
  ADD COLUMN IF NOT EXISTS hero_image_url text;
