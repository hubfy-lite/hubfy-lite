-- ============================================================
-- Migration: Adicionar type e subscription_status à tabela orders
-- Propósito: Diferenciar vendas únicas (one_time) de assinaturas (subscription)
-- ============================================================

-- Enum: order_type
DO $$ BEGIN
  CREATE TYPE public.order_type AS ENUM ('one_time', 'subscription');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Enum: subscription_status (valores futuros para ciclo de assinatura)
DO $$ BEGIN
  CREATE TYPE public.subscription_status AS ENUM (
    'trialing', 'active', 'past_due', 'paused', 'cancelled', 'expired'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Adicionar coluna type (default 'one_time' para orders existentes e novas)
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS type public.order_type NOT NULL DEFAULT 'one_time';

-- Adicionar coluna subscription_status (nullable, sem default)
-- Só setado via evento financeiro confirmado (webhook), nunca por default.
-- NULL = nenhum ciclo de assinatura iniciado.
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS subscription_status public.subscription_status;

-- Index para filtrar orders por type dentro do tenant
CREATE INDEX IF NOT EXISTS idx_orders_type
  ON public.orders(tenant_id, type);

-- Index parcial para buscar subscriptions por status (só quando não-null)
CREATE INDEX IF NOT EXISTS idx_orders_subscription_status
  ON public.orders(tenant_id, subscription_status)
  WHERE subscription_status IS NOT NULL;
