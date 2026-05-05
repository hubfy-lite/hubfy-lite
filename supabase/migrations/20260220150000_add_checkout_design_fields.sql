-- Add checkout design customization fields to tenants
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS checkout_use_brand_colors boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS checkout_bg_color text DEFAULT '#F9F9F9',
  ADD COLUMN IF NOT EXISTS checkout_button_color text,
  ADD COLUMN IF NOT EXISTS checkout_button_style text NOT NULL DEFAULT 'pill';

-- checkout_button_color defaults to NULL → means "use primary_color"
-- checkout_button_style: 'rounded' | 'rectangular' | 'pill'

COMMENT ON COLUMN tenants.checkout_use_brand_colors IS 'When true, checkout uses primary_color for bg/button; when false, uses custom checkout colors';
COMMENT ON COLUMN tenants.checkout_bg_color IS 'Custom checkout background color (hex)';
COMMENT ON COLUMN tenants.checkout_button_color IS 'Custom checkout button color (hex). NULL = use primary_color';
COMMENT ON COLUMN tenants.checkout_button_style IS 'Button border-radius style: rounded, rectangular, pill';
