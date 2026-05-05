-- gateway_product_mappings: trocar ON DELETE SET NULL por ON DELETE CASCADE
-- Se o produto for deletado, o mapping não tem razão de existir.
ALTER TABLE public.gateway_product_mappings
  DROP CONSTRAINT gateway_product_mappings_product_id_fkey,
  ADD CONSTRAINT gateway_product_mappings_product_id_fkey
    FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;

-- Limpar mappings órfãos que já existem (product deletado, mapping ficou)
DELETE FROM public.gateway_product_mappings WHERE product_id IS NULL;
