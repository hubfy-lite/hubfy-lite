-- Rename gumlet_collection_id to gumlet_workspace_id in tenants table
ALTER TABLE public.tenants 
RENAME COLUMN gumlet_collection_id TO gumlet_workspace_id;