-- Add icon_url and theme_mode columns to tenants
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS icon_url text,
  ADD COLUMN IF NOT EXISTS theme_mode text NOT NULL DEFAULT 'light'
    CHECK (theme_mode IN ('light', 'dark'));
