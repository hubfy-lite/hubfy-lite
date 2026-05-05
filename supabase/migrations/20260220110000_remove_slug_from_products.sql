-- Remove slug column from products (not needed — products are identified by id)
alter table public.products drop constraint if exists products_tenant_id_slug_key;
alter table public.products drop column if exists slug;
