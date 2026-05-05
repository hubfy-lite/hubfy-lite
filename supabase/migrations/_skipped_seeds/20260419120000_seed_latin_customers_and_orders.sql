-- ==============================================
-- Seed: +35 customers (US/Latin heritage names) + 35 orders over last 30 days
-- Tenant: hub_0fd699cfbc4d
-- Uses only existing products.
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
    'Sofia Ramirez','Miguel Hernandez','Isabella Garcia','Diego Morales','Camila Reyes',
    'Javier Castillo','Valentina Ortiz','Adrian Vasquez','Gabriela Mendoza','Ricardo Aguilar',
    'Lucia Flores','Mateo Dominguez','Emilia Navarro','Santiago Delgado','Natalia Guerrero',
    'Sebastian Salazar','Alejandra Acosta','Carlos Medina','Victoria Cabrera','Rafael Espinoza',
    'Daniela Cortez','Julian Rivera','Andrea Silva','Fernando Molina','Mariana Escobar',
    'Nicolas Peralta','Catalina Herrera','Diego Vargas','Elena Rojas','Marco Ibarra',
    'Paloma Cardenas','Benjamin Campos','Renata Valdez','Leonardo Figueroa','Adriana Nunez'
  ];
  emails TEXT[] := ARRAY[
    'sofia.ramirez@gmail.com','miguel.hernandez@outlook.com','isabella.garcia@yahoo.com','diego.morales@gmail.com','camila.reyes@hotmail.com',
    'javier.castillo@gmail.com','valentina.ortiz@outlook.com','adrian.vasquez@yahoo.com','gabriela.mendoza@gmail.com','ricardo.aguilar@hotmail.com',
    'lucia.flores@gmail.com','mateo.dominguez@outlook.com','emilia.navarro@yahoo.com','santiago.delgado@gmail.com','natalia.guerrero@hotmail.com',
    'sebastian.salazar@gmail.com','alejandra.acosta@outlook.com','carlos.medina@yahoo.com','victoria.cabrera@gmail.com','rafael.espinoza@hotmail.com',
    'daniela.cortez@gmail.com','julian.rivera@outlook.com','andrea.silva@yahoo.com','fernando.molina@gmail.com','mariana.escobar@hotmail.com',
    'nicolas.peralta@gmail.com','catalina.herrera@outlook.com','diego.vargas@yahoo.com','elena.rojas@gmail.com','marco.ibarra@hotmail.com',
    'paloma.cardenas@gmail.com','benjamin.campos@outlook.com','renata.valdez@yahoo.com','leonardo.figueroa@gmail.com','adriana.nunez@hotmail.com'
  ];

  i INT;
BEGIN
  SELECT id INTO v_tenant_id FROM public.tenants WHERE public_id = 'hub_0fd699cfbc4d';

  FOR i IN 1..35 LOOP
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
