-- =====================================================================
-- Migration: Order Bumps Rework
-- Hotmart envia cada order bump como evento separado com seu próprio
-- transaction ID. O campo parent_purchase_transaction liga o bump
-- à venda principal. Precisamos de campos na orders, não de tabela
-- separada.
-- =====================================================================

-- 1. Adiciona campos de order bump na tabela orders
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS is_order_bump BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS parent_gateway_external_id TEXT;

COMMENT ON COLUMN public.orders.is_order_bump IS
  'true quando a order foi criada a partir de um order bump da Hotmart.';

COMMENT ON COLUMN public.orders.parent_gateway_external_id IS
  'Transaction ID da venda principal no gateway (Hotmart). Preenchido apenas para order bumps. Usado para agrupar bumps com a venda original.';

-- 2. Índice para buscar bumps de uma venda principal
CREATE INDEX IF NOT EXISTS idx_orders_parent_gateway_ext_id
  ON public.orders(parent_gateway_external_id)
  WHERE parent_gateway_external_id IS NOT NULL;

-- 3. Remove tabela order_bump_items (modelo antigo que não reflete a realidade da Hotmart)
DROP TABLE IF EXISTS public.order_bump_items CASCADE;
