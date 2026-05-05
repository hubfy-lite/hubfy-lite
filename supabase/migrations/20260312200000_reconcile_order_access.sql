-- ============================================================
-- Migration: RPC reconcile_order_access
--
-- Safety net que garante acesso correto para uma order.
-- Chamada pelo edge function reconcile-access após triggers.
-- Idempotente: usa ON CONFLICT DO NOTHING.
-- ============================================================

CREATE OR REPLACE FUNCTION public.reconcile_order_access(
  p_order_id uuid,
  p_trigger_source text DEFAULT 'manual'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_order RECORD;
  v_customer RECORD;
  v_product RECORD;
  v_user_id uuid;
  v_auth_user_id uuid;
  v_courses_granted int := 0;
  v_courses_already_had int := 0;
  v_courses_revoked int := 0;
  v_product_has_courses boolean := false;
  v_is_active boolean;
BEGIN
  -- 1. Buscar order
  SELECT o.id, o.customer_id, o.product_id, o.status, o.tenant_id
  INTO v_order
  FROM orders o
  WHERE o.id = p_order_id;

  IF v_order IS NULL THEN
    RETURN jsonb_build_object(
      'status', 'error',
      'error_message', 'Order não encontrada'
    );
  END IF;

  -- 2. Buscar product
  SELECT p.id, p.benefit, p.name
  INTO v_product
  FROM products p
  WHERE p.id = v_order.product_id;

  IF v_product IS NULL THEN
    RETURN jsonb_build_object(
      'status', 'error',
      'error_message', 'Produto não encontrado'
    );
  END IF;

  -- 3. Validar deliverable (se produto é de cursos, precisa ter cursos)
  IF v_product.benefit = 'courses' THEN
    SELECT EXISTS(
      SELECT 1 FROM product_courses WHERE product_id = v_product.id
    ) INTO v_product_has_courses;

    IF NOT v_product_has_courses THEN
      RETURN jsonb_build_object(
        'status', 'error',
        'error_message', 'Produto de cursos sem cursos vinculados em product_courses',
        'customer_id', v_order.customer_id,
        'product_has_courses', false
      );
    END IF;
  ELSE
    -- Produto não é de cursos — não há acesso a materializar em course_customers
    RETURN jsonb_build_object(
      'status', 'ok',
      'customer_id', v_order.customer_id,
      'product_has_courses', false,
      'courses_granted', 0,
      'courses_already_had', 0,
      'courses_revoked', 0,
      'note', 'Produto não é do tipo courses — sem acesso a materializar'
    );
  END IF;

  -- 4. Buscar customer
  SELECT c.id, c.user_id, c.email, c.name
  INTO v_customer
  FROM customers c
  WHERE c.id = v_order.customer_id;

  IF v_customer IS NULL THEN
    RETURN jsonb_build_object(
      'status', 'error',
      'error_message', 'Customer não encontrado'
    );
  END IF;

  v_user_id := v_customer.user_id;

  -- 5. Se customer não tem user_id, tentar encontrar auth.user por email
  IF v_user_id IS NULL THEN
    SELECT au.id INTO v_auth_user_id
    FROM auth.users au
    WHERE lower(au.email) = lower(v_customer.email)
    LIMIT 1;

    IF v_auth_user_id IS NOT NULL THEN
      -- Vincular user_id ao customer (trigger handle_customer_user_link dispara)
      UPDATE customers SET user_id = v_auth_user_id WHERE id = v_customer.id;
      v_user_id := v_auth_user_id;
    ELSE
      -- Não existe auth.user — edge function precisa criar
      RETURN jsonb_build_object(
        'status', 'needs_auth_user',
        'customer_id', v_customer.id,
        'customer_email', v_customer.email,
        'customer_name', v_customer.name,
        'user_id', null,
        'product_has_courses', true,
        'courses_granted', 0,
        'courses_already_had', 0,
        'courses_revoked', 0
      );
    END IF;
  END IF;

  -- 6. Materializar acesso baseado no status da order
  v_is_active := v_order.status IN ('approved', 'completed');

  IF v_is_active THEN
    -- Contar quantos o user já tinha
    SELECT count(*) INTO v_courses_already_had
    FROM course_customers cc
    JOIN product_courses pc ON pc.course_id = cc.course_id
    WHERE pc.product_id = v_order.product_id
      AND cc.user_id = v_user_id;

    -- GRANT: inserir course_customers para cursos do produto
    WITH inserted AS (
      INSERT INTO course_customers (course_id, user_id)
      SELECT pc.course_id, v_user_id
      FROM product_courses pc
      WHERE pc.product_id = v_order.product_id
      ON CONFLICT (course_id, user_id) DO NOTHING
      RETURNING 1
    )
    SELECT count(*) INTO v_courses_granted FROM inserted;

  ELSIF v_order.status IN ('cancelled', 'refunded', 'chargeback') THEN
    -- REVOKE: remover course_customers, protegendo cursos de outras orders ativas
    WITH deleted AS (
      DELETE FROM course_customers cc
      WHERE cc.user_id = v_user_id
        AND cc.course_id IN (
          SELECT pc.course_id FROM product_courses pc WHERE pc.product_id = v_order.product_id
        )
        AND cc.course_id NOT IN (
          SELECT pc2.course_id
          FROM orders o2
          JOIN product_courses pc2 ON pc2.product_id = o2.product_id
          WHERE o2.customer_id = v_order.customer_id
            AND o2.id != v_order.id
            AND o2.status IN ('approved', 'completed')
        )
      RETURNING 1
    )
    SELECT count(*) INTO v_courses_revoked FROM deleted;
  END IF;

  -- Garantir role customer
  INSERT INTO user_roles (user_id, role)
  VALUES (v_user_id, 'customer')
  ON CONFLICT DO NOTHING;

  -- 7. Retornar relatório
  RETURN jsonb_build_object(
    'status', 'ok',
    'customer_id', v_customer.id,
    'user_id', v_user_id,
    'customer_email', v_customer.email,
    'product_has_courses', true,
    'courses_granted', v_courses_granted,
    'courses_already_had', v_courses_already_had,
    'courses_revoked', v_courses_revoked
  );
END;
$$;
