-- Migration: adicionar status 'approved' ao enum order_status
-- PURCHASE_APPROVED (pagamento confirmado, dentro do prazo de garantia)
-- é diferente de PURCHASE_COMPLETE (garantia expirada, venda fechada)

ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'approved';
