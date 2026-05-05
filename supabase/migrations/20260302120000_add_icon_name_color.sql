-- Add icon_name (Lucide icon name) and icon_color (hex bg color) to tenant_settings
-- Used for workspace avatar in sidebar/switcher
ALTER TABLE tenant_settings
  ADD COLUMN IF NOT EXISTS icon_name text,
  ADD COLUMN IF NOT EXISTS icon_color text;
