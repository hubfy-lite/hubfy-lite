-- Add checkout font family field to tenants
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS checkout_font_family text NOT NULL DEFAULT 'Inter';

COMMENT ON COLUMN tenants.checkout_font_family IS 'Font family used in checkout pages (default: Inter)';
