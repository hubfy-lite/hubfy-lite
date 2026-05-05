-- Adiciona coluna gateway_product_id na tabela products
-- para vincular um produto Hubfy ao ID do produto no gateway (ex: Hotmart)
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS gateway_product_id text;

-- Índice para busca rápida pelo ID do gateway (usado no webhook)
CREATE INDEX IF NOT EXISTS idx_products_gateway_product_id
  ON public.products (gateway_product_id)
  WHERE gateway_product_id IS NOT NULL;
