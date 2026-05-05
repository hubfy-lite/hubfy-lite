-- Add display configuration columns to showcases
ALTER TABLE public.showcases
ADD COLUMN theme text NOT NULL DEFAULT 'dark',
ADD COLUMN grid_columns smallint NOT NULL DEFAULT 4;
