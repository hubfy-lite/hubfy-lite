-- Fix: portal_bg_image_url lives in tenant_settings, not tenants.
-- Drop the column accidentally added to tenants.
ALTER TABLE tenants DROP COLUMN IF EXISTS portal_bg_image_url;

-- Backfill tenant_settings: set new default bg image for all tenants.
UPDATE tenant_settings
SET portal_bg_image_url = '/images/portal-backgrounds/olena-bohovyk-dIMJWLx1YbE-unsplash.webp'
WHERE portal_bg_image_url IS NULL
   OR portal_bg_image_url = ''
   OR portal_bg_image_url = '/images/portal-backgrounds/charlesdeluvio-rRWiVQzLm7k-unsplash.webp';
