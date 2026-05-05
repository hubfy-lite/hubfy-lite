-- ==============================================
-- Seed: 30 American customers + 30 orders over last 30 days
-- Tenant: hub_0fd699cfbc4d
-- Updates products with USD prices, then creates auth users (confirmed),
-- customers (via handle_new_user trigger), and orders.
-- ==============================================

-- 1. Update 9 seeded products with real USD prices + active status
UPDATE public.products
SET unit_amount = CASE name
  WHEN 'Full-Stack Fundamentals Bundle'     THEN 3900
  WHEN 'Python Data Science Master'         THEN 3900
  WHEN 'Mobile Development Pro Bundle'      THEN 3900
  WHEN 'AI & Machine Learning Suite'        THEN 5900
  WHEN 'Backend Infrastructure Mastery'     THEN 5900
  WHEN 'Creative Technology Bundle'         THEN 3900
  WHEN 'Complete Programming Path'          THEN 9900
  WHEN 'DevOps & Cloud Infrastructure'      THEN 5900
  WHEN 'AI Automation Specialist'           THEN 5900
END,
    currency = 'USD',
    status = 'active'
WHERE tenant_id = (SELECT id FROM public.tenants WHERE public_id = 'hub_0fd699cfbc4d')
  AND name IN (
    'Full-Stack Fundamentals Bundle',
    'Python Data Science Master',
    'Mobile Development Pro Bundle',
    'AI & Machine Learning Suite',
    'Backend Infrastructure Mastery',
    'Creative Technology Bundle',
    'Complete Programming Path',
    'DevOps & Cloud Infrastructure',
    'AI Automation Specialist'
  );

-- Keep prices table in sync
UPDATE public.prices p
SET unit_amount = pr.unit_amount,
    currency = 'USD'
FROM public.products pr
WHERE p.product_id = pr.id
  AND pr.tenant_id = (SELECT id FROM public.tenants WHERE public_id = 'hub_0fd699cfbc4d');

-- 2. Insert 30 customers + orders
DO $$
DECLARE
  v_tenant_id UUID;
  v_user_id UUID;
  v_customer_id UUID;
  v_product_id UUID;
  v_product_amount INT;
  v_price_id UUID;
  v_days_back INT;
  v_hours_back INT;
  v_created_at TIMESTAMPTZ;

  names TEXT[] := ARRAY[
    'James Smith','Mary Johnson','Robert Williams','Patricia Brown','John Jones',
    'Jennifer Garcia','Michael Miller','Linda Davis','William Rodriguez','Elizabeth Martinez',
    'David Hernandez','Barbara Lopez','Richard Gonzalez','Susan Wilson','Joseph Anderson',
    'Jessica Thomas','Thomas Taylor','Sarah Moore','Christopher Jackson','Karen Martin',
    'Charles Lee','Nancy Perez','Daniel Thompson','Lisa White','Matthew Harris',
    'Betty Sanchez','Anthony Clark','Sandra Ramirez','Mark Lewis','Ashley Robinson'
  ];
  emails TEXT[] := ARRAY[
    'james.smith@gmail.com','mary.johnson@yahoo.com','robert.williams@outlook.com','patricia.brown@gmail.com','john.jones@hotmail.com',
    'jennifer.garcia@gmail.com','michael.miller@yahoo.com','linda.davis@gmail.com','william.rodriguez@outlook.com','elizabeth.martinez@gmail.com',
    'david.hernandez@yahoo.com','barbara.lopez@gmail.com','richard.gonzalez@hotmail.com','susan.wilson@gmail.com','joseph.anderson@outlook.com',
    'jessica.thomas@gmail.com','thomas.taylor@yahoo.com','sarah.moore@gmail.com','chris.jackson@outlook.com','karen.martin@gmail.com',
    'charles.lee@yahoo.com','nancy.perez@gmail.com','daniel.thompson@hotmail.com','lisa.white@gmail.com','matthew.harris@outlook.com',
    'betty.sanchez@gmail.com','anthony.clark@yahoo.com','sandra.ramirez@gmail.com','mark.lewis@outlook.com','ashley.robinson@gmail.com'
  ];

  i INT;
BEGIN
  SELECT id INTO v_tenant_id FROM public.tenants WHERE public_id = 'hub_0fd699cfbc4d';

  FOR i IN 1..30 LOOP
    -- Random date within last 30 days
    v_days_back := floor(random() * 30)::INT;
    v_hours_back := floor(random() * 24)::INT;
    v_created_at := now()
                    - (v_days_back || ' days')::interval
                    - (v_hours_back || ' hours')::interval;

    v_user_id := gen_random_uuid();

    -- Skip if email already exists (idempotency)
    IF EXISTS (SELECT 1 FROM auth.users WHERE email = emails[i]) THEN
      CONTINUE;
    END IF;

    -- Create auth user (handle_new_user trigger will create profile + role + customer)
    INSERT INTO auth.users (
      id, instance_id, aud, role, email,
      encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, confirmation_token,
      recovery_token, email_change_token_new, email_change
    )
    VALUES (
      v_user_id,
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      emails[i],
      extensions.crypt('SeedPass!2026', extensions.gen_salt('bf')),
      v_created_at,
      jsonb_build_object('provider', 'email', 'providers', ARRAY['email']),
      jsonb_build_object(
        'signup_as', 'customer',
        'customer_tenant_id', v_tenant_id::text,
        'name', names[i]
      ),
      v_created_at,
      v_created_at,
      '', '', '', ''
    );

    -- Fetch customer created by trigger
    SELECT id INTO v_customer_id
    FROM public.customers
    WHERE user_id = v_user_id AND tenant_id = v_tenant_id;

    -- Pick a random product for this order
    SELECT id, unit_amount INTO v_product_id, v_product_amount
    FROM public.products
    WHERE tenant_id = v_tenant_id
      AND status = 'active'
    ORDER BY random()
    LIMIT 1;

    -- Grab associated price (optional FK)
    SELECT id INTO v_price_id
    FROM public.prices
    WHERE product_id = v_product_id
    LIMIT 1;

    -- Insert order (trigger auto-assigns order_number)
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

    -- Update customer revenue + country + currency
    UPDATE public.customers
    SET total_revenue_cents = total_revenue_cents + v_product_amount,
        currency = 'USD',
        country = 'United States'
    WHERE id = v_customer_id;
  END LOOP;
END $$;
