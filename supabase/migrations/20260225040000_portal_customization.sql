-- Portal customization columns for tenant auth screens
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS portal_use_brand_colors boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS portal_theme_mode text NOT NULL DEFAULT 'dark',
  ADD COLUMN IF NOT EXISTS portal_bg_image_url text DEFAULT '/images/portal-backgrounds/charlesdeluvio-rRWiVQzLm7k-unsplash.webp',
  ADD COLUMN IF NOT EXISTS portal_button_color text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS portal_button_style text NOT NULL DEFAULT 'rounded';
