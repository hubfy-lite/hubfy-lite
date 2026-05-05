-- Migrate all products with status 'draft' to 'archived'
-- Products now only have two statuses: 'published' and 'archived'
update public.products
  set status = 'archived'
  where status = 'draft';
