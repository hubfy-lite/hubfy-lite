-- ─── Atomic increment of customer total_revenue_cents ───
-- Used by process-checkout after creating an order
CREATE OR REPLACE FUNCTION public.increment_customer_revenue(
  p_customer_id UUID,
  p_amount INTEGER
)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE customers
  SET
    total_revenue_cents = total_revenue_cents + p_amount,
    updated_at = now()
  WHERE id = p_customer_id;
$$;

-- ─── Atomic decrement of customer total_revenue_cents (for refunds) ───
-- Ensures total_revenue_cents never goes below 0
CREATE OR REPLACE FUNCTION public.decrement_customer_revenue(
  p_customer_id UUID,
  p_amount INTEGER
)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE customers
  SET
    total_revenue_cents = GREATEST(total_revenue_cents - p_amount, 0),
    updated_at = now()
  WHERE id = p_customer_id;
$$;
