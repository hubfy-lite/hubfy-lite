-- ==============================================
-- Seed: +30 orders with diverse statuses (not just 'completed')
-- Uses existing customers + existing products.
-- Tenant: hub_0fd699cfbc4d
-- ==============================================

DO $$
DECLARE
  v_tenant_id UUID;
  v_customer_id UUID;
  v_product_id UUID;
  v_product_amount INT;
  v_price_id UUID;
  v_days_back INT;
  v_hours_back INT;
  v_created_at TIMESTAMPTZ;
  v_status public.order_status;
  i INT;

  statuses public.order_status[] := ARRAY[
    'pending','pending','pending','pending','pending','pending','pending','pending',
    'approved','approved','approved','approved','approved','approved',
    'refunded','refunded','refunded','refunded','refunded',
    'cancelled','cancelled','cancelled','cancelled',
    'disputed','disputed','disputed','disputed',
    'chargeback','chargeback','chargeback'
  ]::public.order_status[];
BEGIN
  SELECT id INTO v_tenant_id FROM public.tenants WHERE public_id = 'hub_0fd699cfbc4d';

  FOR i IN 1..30 LOOP
    v_status := statuses[i];

    v_days_back := floor(random() * 30)::INT;
    v_hours_back := floor(random() * 24)::INT;
    v_created_at := now()
                    - (v_days_back || ' days')::interval
                    - (v_hours_back || ' hours')::interval;

    -- Pick a random existing customer
    SELECT id INTO v_customer_id
    FROM public.customers
    WHERE tenant_id = v_tenant_id
    ORDER BY random()
    LIMIT 1;

    -- Pick a random active product
    SELECT id, unit_amount INTO v_product_id, v_product_amount
    FROM public.products
    WHERE tenant_id = v_tenant_id
      AND status = 'active'
    ORDER BY random()
    LIMIT 1;

    SELECT id INTO v_price_id
    FROM public.prices
    WHERE product_id = v_product_id
    LIMIT 1;

    INSERT INTO public.orders (
      tenant_id, customer_id, product_id, price_id,
      status, type, unit_amount, currency, source,
      payment_method,
      created_at, updated_at
    )
    VALUES (
      v_tenant_id, v_customer_id, v_product_id, v_price_id,
      v_status, 'one_time', v_product_amount, 'USD', 'hubfy',
      'free',
      v_created_at, v_created_at
    );

    -- Only count revenue for statuses that represent successful payment
    IF v_status IN ('completed','approved') THEN
      UPDATE public.customers
      SET total_revenue_cents = total_revenue_cents + v_product_amount
      WHERE id = v_customer_id;
    END IF;
  END LOOP;
END $$;
