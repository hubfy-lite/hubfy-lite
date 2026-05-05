-- ==============================================
-- Seed: +20 orders from existing customers buying DIFFERENT products
-- Dates must differ from customer's previous order dates.
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
  v_attempts INT;
  v_inserted INT := 0;
  v_target INT := 20;
BEGIN
  SELECT id INTO v_tenant_id FROM public.tenants WHERE public_id = 'hub_0fd699cfbc4d';

  WHILE v_inserted < v_target LOOP
    -- Pick a random customer that has NOT bought all products yet
    SELECT c.id INTO v_customer_id
    FROM public.customers c
    WHERE c.tenant_id = v_tenant_id
      AND EXISTS (
        SELECT 1 FROM public.products p
        WHERE p.tenant_id = v_tenant_id
          AND p.status = 'active'
          AND NOT EXISTS (
            SELECT 1 FROM public.orders o
            WHERE o.customer_id = c.id
              AND o.product_id = p.id
          )
      )
    ORDER BY random()
    LIMIT 1;

    EXIT WHEN v_customer_id IS NULL;

    -- Pick a product this customer has not yet bought
    SELECT p.id, p.unit_amount INTO v_product_id, v_product_amount
    FROM public.products p
    WHERE p.tenant_id = v_tenant_id
      AND p.status = 'active'
      AND NOT EXISTS (
        SELECT 1 FROM public.orders o
        WHERE o.customer_id = v_customer_id
          AND o.product_id = p.id
      )
    ORDER BY random()
    LIMIT 1;

    -- Find a date the customer doesn't already have an order on (try up to 10 times)
    v_attempts := 0;
    LOOP
      v_days_back := floor(random() * 30)::INT;
      v_hours_back := floor(random() * 24)::INT;
      v_created_at := date_trunc('hour', now()
                      - (v_days_back || ' days')::interval
                      - (v_hours_back || ' hours')::interval);

      EXIT WHEN NOT EXISTS (
        SELECT 1 FROM public.orders o
        WHERE o.customer_id = v_customer_id
          AND date_trunc('hour', o.created_at) = v_created_at
      );

      v_attempts := v_attempts + 1;
      EXIT WHEN v_attempts >= 10;
    END LOOP;

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
      'completed', 'one_time', v_product_amount, 'USD', 'hubfy',
      'free',
      v_created_at, v_created_at
    );

    UPDATE public.customers
    SET total_revenue_cents = total_revenue_cents + v_product_amount
    WHERE id = v_customer_id;

    v_inserted := v_inserted + 1;
  END LOOP;
END $$;
