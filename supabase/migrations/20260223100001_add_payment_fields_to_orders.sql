-- Add payment gateway fields to orders
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS zoop_transaction_id text,
  ADD COLUMN IF NOT EXISTS payment_method text NOT NULL DEFAULT 'free'
    CHECK (payment_method IN ('free','pix','credit','boleto'));

COMMENT ON COLUMN public.orders.zoop_transaction_id IS 'Zoop transaction ID for paid orders';
COMMENT ON COLUMN public.orders.payment_method IS 'Payment method used: free, pix, credit, boleto';

-- Index for webhook lookups by transaction_id
CREATE INDEX IF NOT EXISTS idx_orders_zoop_transaction_id
  ON public.orders(zoop_transaction_id) WHERE zoop_transaction_id IS NOT NULL;
