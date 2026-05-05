-- ============================================================
-- Remove gateways não-Hotmart
-- Mantém apenas: hotmart
-- Remove: kiwify, kirvano, lastlink, stripe, paypal, adyen
-- ============================================================

-- ─── 1. Remover integrações ativas de gateways removidos ────
DELETE FROM public.tenant_integrations
  WHERE provider IN ('kiwify', 'kirvano', 'lastlink', 'stripe', 'paypal', 'adyen');

-- ─── 2. Remover credential rules ────────────────────────────
DELETE FROM public.integration_credential_rules
  WHERE provider IN ('kiwify', 'kirvano', 'lastlink', 'stripe', 'paypal', 'adyen');

-- ─── 3. Recriar índice parcial — somente hotmart ─────────────
DROP INDEX IF EXISTS public.idx_one_active_payment_gateway;

CREATE UNIQUE INDEX idx_one_active_payment_gateway
  ON public.tenant_integrations (tenant_id)
  WHERE status = 'active'
    AND provider IN ('hotmart');

-- ─── 4. Recriar função de trigger — somente hotmart ──────────
CREATE OR REPLACE FUNCTION public.enforce_single_active_gateway()
RETURNS TRIGGER AS $$
DECLARE
  payment_providers TEXT[] := ARRAY['hotmart'];
BEGIN
  IF NOT (NEW.provider = ANY(payment_providers)) THEN
    RETURN NEW;
  END IF;

  IF NEW.status = 'active' THEN
    UPDATE public.tenant_integrations
    SET status = 'inactive', updated_at = now()
    WHERE tenant_id = NEW.tenant_id
      AND provider = ANY(payment_providers)
      AND provider != NEW.provider
      AND status = 'active';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ─── 5. Remover colunas Stripe da tabela subscriptions (se existir) ───────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'subscriptions'
  ) THEN
    ALTER TABLE public.subscriptions
      DROP COLUMN IF EXISTS stripe_customer_id,
      DROP COLUMN IF EXISTS stripe_subscription_id,
      DROP COLUMN IF EXISTS stripe_price_id;
  END IF;
END $$;

-- ─── 6. Remover 'paypal' do CHECK constraint de payment_method
ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_payment_method_check;

ALTER TABLE public.orders
  ADD CONSTRAINT orders_payment_method_check
  CHECK (payment_method IN (
    'credit_card', 'debit_card', 'pix', 'billet', 'free',
    'bank_transfer', 'debit', 'dinheiro', 'financed',
    'picpay', 'google_pay', 'samsung_pay', 'hybrid', 'hotmart'
  ));
