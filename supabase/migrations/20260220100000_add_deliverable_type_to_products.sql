-- Add benefit to products
-- Defines what the customer receives: downloadable files or access to a showcase
alter table public.products
  add column benefit text check (benefit in ('files', 'showcase'));

comment on column public.products.benefit is
  'Type of benefit: files (downloadable assets) or showcase (access to a showcase). Immutable after creation.';
