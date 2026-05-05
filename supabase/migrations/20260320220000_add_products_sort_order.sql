-- Add sort_order column to products for custom portal ordering
ALTER TABLE public.products ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0;

-- Initialize existing products preserving current display order (created_at DESC)
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY tenant_id ORDER BY created_at DESC) AS rn
  FROM public.products
)
UPDATE public.products SET sort_order = ranked.rn FROM ranked WHERE products.id = ranked.id;

-- Index for efficient tenant + sort_order queries
CREATE INDEX idx_products_tenant_sort ON public.products(tenant_id, sort_order);
