-- ============================================================
-- Update run_customer_csv_import to accept p_import_type
-- 'customers' = products mandatory, creates orders (current behavior)
-- 'contacts'  = no products, no orders
-- Default = 'customers' (backward compat with existing callers)
-- ============================================================

-- Drop old 4-param signature
DROP FUNCTION IF EXISTS public.run_customer_csv_import(uuid, uuid, text, jsonb);

CREATE OR REPLACE FUNCTION public.run_customer_csv_import(
  p_tenant_id    uuid,
  p_imported_by  uuid,
  p_filename     text,
  p_rows         jsonb,
  p_import_type  text DEFAULT 'customers'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_batch_id          uuid;
  v_total_rows        int := jsonb_array_length(p_rows);
  v_created_count     int := 0;
  v_updated_count     int := 0;
  v_skipped_count     int := 0;
  v_error_count       int := 0;
  v_orders_created    int := 0;
  v_next_order_number int;
  v_row               jsonb;
  v_row_result        jsonb;
  v_all_results       jsonb := '[]'::jsonb;
  -- per-row vars
  v_line              int;
  v_email             text;
  v_name              text;
  v_existing          record;
  v_customer_id       uuid;
  v_action            text;       -- created | updated | existing
  v_warnings          jsonb;
  v_orders_created_arr  jsonb;
  v_orders_skipped_arr  jsonb;
  -- customer field vars
  v_phone             text;
  v_phone_cc          text;
  v_first_name        text;
  v_last_name         text;
  v_city              text;
  v_state             text;
  v_country           text;
  v_document          text;
  v_document_type     text;
  v_ext_customer_id   text;
  -- update tracking
  v_updates           jsonb;
  v_has_updates       boolean;
  -- product vars
  v_prod              jsonb;
  v_product_id        uuid;
  v_product_pub_id    text;
  v_idem_key          text;
  v_existing_order    uuid;
  v_inserted_order_id uuid;
  -- user linking
  v_auth_user_id      uuid;
  -- error handling
  v_err_msg           text;
BEGIN
  -- ─── 1. Criar batch ─────────────────────────────────────────
  INSERT INTO customer_import_batches (tenant_id, imported_by, filename, status, total_rows, import_type)
  VALUES (p_tenant_id, p_imported_by, p_filename, 'processing', v_total_rows, p_import_type)
  RETURNING id INTO v_batch_id;

  -- ─── 2. Calcular próximo order_number ───────────────────────
  SELECT COALESCE(MAX(order_number), 0) + 1
    INTO v_next_order_number
    FROM orders
   WHERE tenant_id = p_tenant_id;

  -- ─── 3. Bloco transacional para customers + orders ──────────
  BEGIN
    FOR v_row IN SELECT * FROM jsonb_array_elements(p_rows)
    LOOP
      v_line    := (v_row ->> 'line')::int;
      v_email   := v_row ->> 'email';
      v_name    := v_row ->> 'name';
      v_warnings         := '[]'::jsonb;
      v_orders_created_arr := '[]'::jsonb;
      v_orders_skipped_arr := '[]'::jsonb;

      -- Extract optional fields (nullif handles empty strings)
      v_phone           := NULLIF(TRIM(v_row ->> 'phone'), '');
      v_phone_cc        := NULLIF(TRIM(v_row ->> 'phone_country_code'), '');
      v_first_name      := NULLIF(TRIM(v_row ->> 'first_name'), '');
      v_last_name       := NULLIF(TRIM(v_row ->> 'last_name'), '');
      v_city            := NULLIF(TRIM(v_row ->> 'city'), '');
      v_state           := NULLIF(TRIM(v_row ->> 'state'), '');
      v_country         := NULLIF(TRIM(v_row ->> 'country'), '');
      v_document        := NULLIF(TRIM(v_row ->> 'document'), '');
      v_document_type   := NULLIF(TRIM(v_row ->> 'document_type'), '');
      v_ext_customer_id := NULLIF(TRIM(v_row ->> 'external_customer_id'), '');

      -- ── Customer upsert ──────────────────────────────────────
      SELECT id, name, phone, phone_country_code, first_name, last_name,
             city, region, country, document, document_type,
             external_customer_id, user_id
        INTO v_existing
        FROM customers
       WHERE tenant_id = p_tenant_id AND email = v_email;

      IF v_existing IS NULL THEN
        -- New customer
        INSERT INTO customers (
          tenant_id, email, name, phone, phone_country_code,
          first_name, last_name, city, region, country,
          document, document_type, external_customer_id
        ) VALUES (
          p_tenant_id, v_email, v_name, v_phone, v_phone_cc,
          v_first_name, v_last_name, v_city, v_state, v_country,
          v_document, v_document_type, v_ext_customer_id
        ) RETURNING id INTO v_customer_id;

        v_action := 'created';
        v_created_count := v_created_count + 1;
      ELSE
        v_customer_id := v_existing.id;
        v_has_updates := false;

        -- Fill empty fields only + detect divergences
        -- Name
        IF v_name IS NOT NULL AND v_existing.name IS NULL THEN
          v_has_updates := true;
        ELSIF v_name IS NOT NULL AND v_existing.name IS NOT NULL AND v_name <> v_existing.name THEN
          v_warnings := v_warnings || jsonb_build_array('Divergência: name: CSV="' || v_name || '" vs DB="' || v_existing.name || '"');
        END IF;

        -- Phone
        IF v_phone IS NOT NULL AND v_existing.phone IS NULL THEN
          v_has_updates := true;
        ELSIF v_phone IS NOT NULL AND v_existing.phone IS NOT NULL AND v_phone <> v_existing.phone THEN
          v_warnings := v_warnings || jsonb_build_array('Divergência: phone: CSV="' || v_phone || '" vs DB="' || v_existing.phone || '"');
        END IF;

        -- Phone country code
        IF v_phone_cc IS NOT NULL AND v_existing.phone_country_code IS NULL THEN
          v_has_updates := true;
        ELSIF v_phone_cc IS NOT NULL AND v_existing.phone_country_code IS NOT NULL AND v_phone_cc <> v_existing.phone_country_code THEN
          v_warnings := v_warnings || jsonb_build_array('Divergência: phone_country_code: CSV="' || v_phone_cc || '" vs DB="' || v_existing.phone_country_code || '"');
        END IF;

        -- First name
        IF v_first_name IS NOT NULL AND v_existing.first_name IS NULL THEN
          v_has_updates := true;
        ELSIF v_first_name IS NOT NULL AND v_existing.first_name IS NOT NULL AND v_first_name <> v_existing.first_name THEN
          v_warnings := v_warnings || jsonb_build_array('Divergência: first_name: CSV="' || v_first_name || '" vs DB="' || v_existing.first_name || '"');
        END IF;

        -- Last name
        IF v_last_name IS NOT NULL AND v_existing.last_name IS NULL THEN
          v_has_updates := true;
        ELSIF v_last_name IS NOT NULL AND v_existing.last_name IS NOT NULL AND v_last_name <> v_existing.last_name THEN
          v_warnings := v_warnings || jsonb_build_array('Divergência: last_name: CSV="' || v_last_name || '" vs DB="' || v_existing.last_name || '"');
        END IF;

        -- City
        IF v_city IS NOT NULL AND v_existing.city IS NULL THEN
          v_has_updates := true;
        ELSIF v_city IS NOT NULL AND v_existing.city IS NOT NULL AND v_city <> v_existing.city THEN
          v_warnings := v_warnings || jsonb_build_array('Divergência: city: CSV="' || v_city || '" vs DB="' || v_existing.city || '"');
        END IF;

        -- State (→ region)
        IF v_state IS NOT NULL AND v_existing.region IS NULL THEN
          v_has_updates := true;
        ELSIF v_state IS NOT NULL AND v_existing.region IS NOT NULL AND v_state <> v_existing.region THEN
          v_warnings := v_warnings || jsonb_build_array('Divergência: state: CSV="' || v_state || '" vs DB="' || v_existing.region || '"');
        END IF;

        -- Country
        IF v_country IS NOT NULL AND v_existing.country IS NULL THEN
          v_has_updates := true;
        ELSIF v_country IS NOT NULL AND v_existing.country IS NOT NULL AND v_country <> v_existing.country THEN
          v_warnings := v_warnings || jsonb_build_array('Divergência: country: CSV="' || v_country || '" vs DB="' || v_existing.country || '"');
        END IF;

        -- Document
        IF v_document IS NOT NULL AND v_existing.document IS NULL THEN
          v_has_updates := true;
        ELSIF v_document IS NOT NULL AND v_existing.document IS NOT NULL AND v_document <> v_existing.document THEN
          v_warnings := v_warnings || jsonb_build_array('Divergência: document: CSV="' || v_document || '" vs DB="' || v_existing.document || '"');
        END IF;

        -- Document type
        IF v_document_type IS NOT NULL AND v_existing.document_type IS NULL THEN
          v_has_updates := true;
        ELSIF v_document_type IS NOT NULL AND v_existing.document_type IS NOT NULL AND v_document_type <> v_existing.document_type THEN
          v_warnings := v_warnings || jsonb_build_array('Divergência: document_type: CSV="' || v_document_type || '" vs DB="' || v_existing.document_type || '"');
        END IF;

        -- External customer ID
        IF v_ext_customer_id IS NOT NULL AND v_existing.external_customer_id IS NULL THEN
          v_has_updates := true;
        ELSIF v_ext_customer_id IS NOT NULL AND v_existing.external_customer_id IS NOT NULL AND v_ext_customer_id <> v_existing.external_customer_id THEN
          v_warnings := v_warnings || jsonb_build_array('Divergência: external_customer_id: CSV="' || v_ext_customer_id || '" vs DB="' || v_existing.external_customer_id || '"');
        END IF;

        IF v_has_updates THEN
          UPDATE customers SET
            name                 = COALESCE(customers.name, v_name),
            phone                = COALESCE(customers.phone, v_phone),
            phone_country_code   = COALESCE(customers.phone_country_code, v_phone_cc),
            first_name           = COALESCE(customers.first_name, v_first_name),
            last_name            = COALESCE(customers.last_name, v_last_name),
            city                 = COALESCE(customers.city, v_city),
            region               = COALESCE(customers.region, v_state),
            country              = COALESCE(customers.country, v_country),
            document             = COALESCE(customers.document, v_document),
            document_type        = COALESCE(customers.document_type, v_document_type),
            external_customer_id = COALESCE(customers.external_customer_id, v_ext_customer_id)
          WHERE id = v_customer_id;

          v_action := 'updated';
          v_updated_count := v_updated_count + 1;
        ELSE
          v_action := 'existing';
          v_skipped_count := v_skipped_count + 1;
        END IF;
      END IF;

      -- ── Link auth user ───────────────────────────────────────
      IF v_existing IS NULL OR v_existing.user_id IS NULL THEN
        SELECT id INTO v_auth_user_id
          FROM auth.users
         WHERE lower(email) = lower(v_email)
         LIMIT 1;

        IF v_auth_user_id IS NOT NULL THEN
          UPDATE customers SET user_id = v_auth_user_id WHERE id = v_customer_id AND user_id IS NULL;
        END IF;
      END IF;

      -- ── Create orders for resolved products (ONLY in customers mode) ──
      IF p_import_type = 'customers' AND v_row -> 'resolved_products' IS NOT NULL AND jsonb_array_length(v_row -> 'resolved_products') > 0 THEN
        FOR v_prod IN SELECT * FROM jsonb_array_elements(v_row -> 'resolved_products')
        LOOP
          v_product_id     := (v_prod ->> 'product_id')::uuid;
          v_product_pub_id := v_prod ->> 'product_public_id';

          -- Check existing active order
          SELECT id INTO v_existing_order
            FROM orders
           WHERE customer_id = v_customer_id
             AND product_id = v_product_id
             AND status IN ('approved', 'completed')
           LIMIT 1;

          IF v_existing_order IS NOT NULL THEN
            v_orders_skipped_arr := v_orders_skipped_arr || jsonb_build_array(v_product_pub_id);
            CONTINUE;
          END IF;

          -- Build idempotency key
          v_idem_key := 'csv_import:' || v_batch_id || ':' || v_email || ':' || v_product_pub_id;

          -- Insert order with explicit order_number
          INSERT INTO orders (
            tenant_id, customer_id, product_id, status, unit_amount,
            type, source, idempotency_key, order_number
          ) VALUES (
            p_tenant_id, v_customer_id, v_product_id, 'completed', 0,
            'one_time', 'csv_import', v_idem_key, v_next_order_number
          )
          ON CONFLICT (idempotency_key) WHERE idempotency_key IS NOT NULL DO NOTHING
          RETURNING id INTO v_inserted_order_id;

          IF v_inserted_order_id IS NOT NULL THEN
            v_orders_created_arr := v_orders_created_arr || jsonb_build_array(v_product_pub_id);
            v_orders_created := v_orders_created + 1;
            v_next_order_number := v_next_order_number + 1;
          ELSE
            -- Idempotency collision → skipped
            v_orders_skipped_arr := v_orders_skipped_arr || jsonb_build_array(v_product_pub_id);
          END IF;
        END LOOP;
      END IF;

      -- ── Adjust final row status ──────────────────────────────
      -- If customer existed but new orders were created → updated (customers mode only)
      IF p_import_type = 'customers' AND v_action = 'existing' AND jsonb_array_length(v_orders_created_arr) > 0 THEN
        v_action := 'updated';
        v_skipped_count := v_skipped_count - 1;
        v_updated_count := v_updated_count + 1;
      END IF;

      DECLARE
        v_status text;
      BEGIN
        IF p_import_type = 'contacts' THEN
          -- Contacts mode: status reflects only customer upsert
          IF v_action = 'created' THEN
            v_status := 'created';
          ELSIF v_action = 'updated' THEN
            v_status := 'updated';
          ELSE
            v_status := 'skipped';
          END IF;
        ELSE
          -- Customers mode: original logic
          IF v_action = 'created' OR (v_action = 'updated' AND jsonb_array_length(v_orders_created_arr) > 0) THEN
            v_status := v_action;
          ELSIF v_action = 'existing' THEN
            v_status := 'skipped';
          ELSE
            v_status := v_action;
          END IF;
        END IF;

        v_row_result := jsonb_build_object(
          'line', v_line,
          'email', v_email,
          'status', v_status,
          'customer_action', v_action,
          'orders_created', v_orders_created_arr,
          'orders_skipped', v_orders_skipped_arr,
          'warnings', v_warnings,
          'errors', '[]'::jsonb
        );
      END;

      v_all_results := v_all_results || jsonb_build_array(v_row_result);
    END LOOP;

    -- ─── 4. Sucesso: atualizar batch ──────────────────────────
    UPDATE customer_import_batches SET
      status              = CASE WHEN v_error_count = v_total_rows THEN 'failed' ELSE 'completed' END,
      created_count       = v_created_count,
      updated_count       = v_updated_count,
      skipped_count       = v_skipped_count,
      error_count         = v_error_count,
      orders_created_count = v_orders_created,
      result              = jsonb_build_object('summary', jsonb_build_object(
                              'total_rows', v_total_rows,
                              'created_count', v_created_count,
                              'updated_count', v_updated_count,
                              'skipped_count', v_skipped_count,
                              'error_count', v_error_count,
                              'orders_created_count', v_orders_created
                            ), 'rows', v_all_results),
      completed_at        = now()
    WHERE id = v_batch_id;

  EXCEPTION WHEN OTHERS THEN
    -- ─── 5. Falha: rollback customers/orders, marcar batch como failed ──
    GET STACKED DIAGNOSTICS v_err_msg = MESSAGE_TEXT;

    UPDATE customer_import_batches SET
      status       = 'failed',
      error_count  = v_total_rows,
      result       = jsonb_build_object('error', v_err_msg),
      completed_at = now()
    WHERE id = v_batch_id;

    RETURN jsonb_build_object(
      'batch_id', v_batch_id,
      'success', false,
      'error', v_err_msg,
      'total_rows', v_total_rows,
      'created_count', 0,
      'updated_count', 0,
      'skipped_count', 0,
      'error_count', v_total_rows,
      'orders_created_count', 0,
      'rows', '[]'::jsonb
    );
  END;

  -- ─── 6. Retornar resultado ────────────────────────────────
  RETURN jsonb_build_object(
    'batch_id', v_batch_id,
    'success', true,
    'total_rows', v_total_rows,
    'created_count', v_created_count,
    'updated_count', v_updated_count,
    'skipped_count', v_skipped_count,
    'error_count', v_error_count,
    'orders_created_count', v_orders_created,
    'rows', v_all_results
  );
END;
$$;

-- Segurança: apenas service_role pode executar
REVOKE EXECUTE ON FUNCTION public.run_customer_csv_import(uuid, uuid, text, jsonb, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.run_customer_csv_import(uuid, uuid, text, jsonb, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.run_customer_csv_import(uuid, uuid, text, jsonb, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.run_customer_csv_import(uuid, uuid, text, jsonb, text) TO service_role;
