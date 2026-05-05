-- ==============================================
-- Seed: +30 customers (uncommon English names) + 30 orders over last 30 days
-- Tenant: hub_0fd699cfbc4d
-- Uses only existing products (no product changes).
-- ==============================================

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
    'Atlas Kingsley','Juniper Vance','Peregrine Ashford','Marlowe Sinclair','Orion Blackwell',
    'Seraphina Quinn','Caspian Wilder','Thessaly Crane','Archer Pennington','Ophelia Rigby',
    'Caius Thornton','Lumen Fairfax','Zephyr Whitlock','Indigo Marsh','Calloway Finch',
    'Wrenley Ashby','Sterling Greaves','Isolde Prescott','Huxley Draven','Saffron Blakely',
    'Cormac Wexley','Elowen Hargrove','Theron Kincaid','Marigold Chase','Beckett Havelock',
    'Sylvie Ashcroft','Rowan Estabrook','Anouk Beaumont','Barnaby Holloway','Perpetua Langston'
  ];
  emails TEXT[] := ARRAY[
    'atlas.kingsley@gmail.com','juniper.vance@outlook.com','peregrine.ashford@yahoo.com','marlowe.sinclair@gmail.com','orion.blackwell@hotmail.com',
    'seraphina.quinn@gmail.com','caspian.wilder@outlook.com','thessaly.crane@gmail.com','archer.pennington@yahoo.com','ophelia.rigby@gmail.com',
    'caius.thornton@hotmail.com','lumen.fairfax@gmail.com','zephyr.whitlock@outlook.com','indigo.marsh@gmail.com','calloway.finch@yahoo.com',
    'wrenley.ashby@gmail.com','sterling.greaves@hotmail.com','isolde.prescott@gmail.com','huxley.draven@outlook.com','saffron.blakely@gmail.com',
    'cormac.wexley@yahoo.com','elowen.hargrove@gmail.com','theron.kincaid@hotmail.com','marigold.chase@gmail.com','beckett.havelock@outlook.com',
    'sylvie.ashcroft@gmail.com','rowan.estabrook@yahoo.com','anouk.beaumont@gmail.com','barnaby.holloway@hotmail.com','perpetua.langston@outlook.com'
  ];

  i INT;
BEGIN
  SELECT id INTO v_tenant_id FROM public.tenants WHERE public_id = 'hub_0fd699cfbc4d';

  FOR i IN 1..30 LOOP
    v_days_back := floor(random() * 30)::INT;
    v_hours_back := floor(random() * 24)::INT;
    v_created_at := now()
                    - (v_days_back || ' days')::interval
                    - (v_hours_back || ' hours')::interval;

    v_user_id := gen_random_uuid();

    IF EXISTS (SELECT 1 FROM auth.users WHERE email = emails[i]) THEN
      CONTINUE;
    END IF;

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

    SELECT id INTO v_customer_id
    FROM public.customers
    WHERE user_id = v_user_id AND tenant_id = v_tenant_id;

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
      'completed', 'one_time', v_product_amount, 'USD', 'hubfy',
      'free',
      v_created_at, v_created_at
    );

    UPDATE public.customers
    SET total_revenue_cents = total_revenue_cents + v_product_amount,
        currency = 'USD',
        country = 'United States'
    WHERE id = v_customer_id;
  END LOOP;
END $$;
