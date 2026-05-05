-- Add color column to asset_folders
ALTER TABLE public.asset_folders
  ADD COLUMN color TEXT NOT NULL DEFAULT 'gray'
  CONSTRAINT asset_folders_color_check
    CHECK (color IN ('red', 'orange', 'yellow', 'green', 'blue', 'gray'));
