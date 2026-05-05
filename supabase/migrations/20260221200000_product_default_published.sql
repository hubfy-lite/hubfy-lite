-- Change default product status from 'draft' to 'published'
ALTER TABLE public.products
  ALTER COLUMN status SET DEFAULT 'published';
