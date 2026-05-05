-- ============================================================
-- Migration: RPC unificada set_product_deliverable + sync course_customers
--
-- 1. UNIQUE em product_assets (habilita upsert)
-- 2. RPC set_product_deliverable (substitui configure + update flows)
-- 3. Trigger sync_course_customers_on_product_courses_change
-- 4. Drop configure_product_deliverable (substituída)
-- ============================================================

-- 1. UNIQUE constraint para habilitar upsert com ON CONFLICT
ALTER TABLE public.product_assets
  ADD CONSTRAINT product_assets_product_asset_unique UNIQUE (product_id, asset_id);

-- 2. RPC unificada: configuração inicial + atualização de links
CREATE OR REPLACE FUNCTION public.set_product_deliverable(
  p_product_id uuid,
  p_benefit text,
  p_asset_ids uuid[] DEFAULT NULL,
  p_course_ids uuid[] DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_product RECORD;
  v_is_initial_config boolean := false;
  v_linked_count int := 0;
  v_normalized_asset_ids uuid[];
  v_normalized_course_ids uuid[];
BEGIN
  -- 1. Lock produto
  SELECT id, tenant_id, status, benefit
    INTO v_product
    FROM public.products
   WHERE id = p_product_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Product not found';
  END IF;

  -- 2. Auth
  IF NOT public.is_tenant_editor(v_product.tenant_id) AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  -- 3. Determinar modo: configuração inicial ou atualização
  IF v_product.benefit IS NULL THEN
    v_is_initial_config := true;
  ELSIF v_product.benefit != p_benefit THEN
    RAISE EXCEPTION 'O tipo de entregável não pode ser alterado (atual: %, solicitado: %)',
      v_product.benefit, p_benefit;
  END IF;

  -- 4. Validar tipo
  IF p_benefit NOT IN ('files', 'courses') THEN
    RAISE EXCEPTION 'benefit must be files or courses';
  END IF;

  -- 5. Normalizar IDs (deduplicar, preservar ordem)
  SELECT COALESCE(array_agg(asset_id ORDER BY ord), ARRAY[]::uuid[])
    INTO v_normalized_asset_ids
    FROM (
      SELECT asset_id, MIN(ord) AS ord
        FROM unnest(COALESCE(p_asset_ids, ARRAY[]::uuid[])) WITH ORDINALITY AS t(asset_id, ord)
       WHERE asset_id IS NOT NULL
       GROUP BY asset_id
    ) s;

  SELECT COALESCE(array_agg(course_id ORDER BY ord), ARRAY[]::uuid[])
    INTO v_normalized_course_ids
    FROM (
      SELECT course_id, MIN(ord) AS ord
        FROM unnest(COALESCE(p_course_ids, ARRAY[]::uuid[])) WITH ORDINALITY AS t(course_id, ord)
       WHERE course_id IS NOT NULL
       GROUP BY course_id
    ) s;

  -- 6. Validar mínimo
  IF p_benefit = 'files' AND cardinality(v_normalized_asset_ids) = 0 THEN
    RAISE EXCEPTION 'At least one asset is required';
  END IF;

  IF p_benefit = 'courses' AND cardinality(v_normalized_course_ids) = 0 THEN
    RAISE EXCEPTION 'At least one course is required';
  END IF;

  -- 7. Aplicar links (INSERT-first-DELETE-second evita downgrade trigger)
  IF p_benefit = 'files' THEN
    -- Upsert: insere novos, atualiza sort_order dos existentes
    INSERT INTO public.product_assets (product_id, asset_id, sort_order)
    SELECT p_product_id, asset_id, ord - 1
      FROM unnest(v_normalized_asset_ids) WITH ORDINALITY AS t(asset_id, ord)
    ON CONFLICT (product_id, asset_id) DO UPDATE SET sort_order = EXCLUDED.sort_order;

    -- Remove apenas os que saíram da lista
    DELETE FROM public.product_assets
     WHERE product_id = p_product_id
       AND asset_id != ALL(v_normalized_asset_ids);

    v_linked_count := cardinality(v_normalized_asset_ids);

    -- Limpar courses órfãos (se configuração inicial mudou de courses pra files, improvável mas seguro)
    DELETE FROM public.product_courses WHERE product_id = p_product_id;

  ELSE -- courses
    -- Insert novos (idempotente)
    INSERT INTO public.product_courses (product_id, course_id)
    SELECT p_product_id, course_id
      FROM unnest(v_normalized_course_ids) AS t(course_id)
    ON CONFLICT (product_id, course_id) DO NOTHING;

    -- Remove apenas os que saíram da lista
    -- O trigger sync_course_customers cuida de GRANT/REVOKE em course_customers
    DELETE FROM public.product_courses
     WHERE product_id = p_product_id
       AND course_id != ALL(v_normalized_course_ids);

    v_linked_count := cardinality(v_normalized_course_ids);

    -- Limpar assets órfãos
    DELETE FROM public.product_assets WHERE product_id = p_product_id;
  END IF;

  -- 8. Setar benefit se configuração inicial
  IF v_is_initial_config THEN
    UPDATE public.products SET benefit = p_benefit WHERE id = p_product_id;
  END IF;

  RETURN jsonb_build_object(
    'benefit', p_benefit,
    'linked_count', v_linked_count
  );
END;
$$;

-- 3. Trigger: sincronizar course_customers quando product_courses muda
CREATE OR REPLACE FUNCTION public.sync_course_customers_on_product_courses_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- GRANT: conceder acesso ao novo curso para todos os clientes com pedidos ativos
    INSERT INTO course_customers (course_id, user_id)
    SELECT NEW.course_id, c.user_id
      FROM orders o
      JOIN customers c ON c.id = o.customer_id
     WHERE o.product_id = NEW.product_id
       AND o.status IN ('approved', 'completed')
       AND c.user_id IS NOT NULL
    ON CONFLICT (course_id, user_id) DO NOTHING;

    RETURN NEW;

  ELSIF TG_OP = 'DELETE' THEN
    -- REVOKE: revogar acesso ao curso removido, protegendo multi-produto
    DELETE FROM course_customers cc
     WHERE cc.course_id = OLD.course_id
       AND cc.user_id IN (
         -- Usuários que compraram este produto
         SELECT c.user_id
           FROM orders o
           JOIN customers c ON c.id = o.customer_id
          WHERE o.product_id = OLD.product_id
            AND o.status IN ('approved', 'completed')
            AND c.user_id IS NOT NULL
       )
       AND NOT EXISTS (
         -- Proteger se o usuário tem acesso ao mesmo curso via OUTRO caminho
         SELECT 1
           FROM orders o2
           JOIN product_courses pc2 ON pc2.product_id = o2.product_id
           JOIN customers c2 ON c2.id = o2.customer_id
          WHERE pc2.course_id = OLD.course_id
            AND pc2.id != OLD.id
            AND o2.status IN ('approved', 'completed')
            AND c2.user_id = cc.user_id
       );

    RETURN OLD;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trg_sync_course_customers
  AFTER INSERT OR DELETE ON public.product_courses
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_course_customers_on_product_courses_change();

-- 4. Drop RPC antiga (substituída por set_product_deliverable)
DROP FUNCTION IF EXISTS public.configure_product_deliverable(uuid, text, uuid[], uuid[]);
