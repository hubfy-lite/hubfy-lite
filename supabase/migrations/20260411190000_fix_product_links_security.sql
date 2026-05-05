-- ============================================================
-- Migration: Correções de segurança e qualidade em product_links
--
-- 1. RLS: policy de SELECT por compra real (não por tenant)
-- 2. RLS: editor policy inclui is_admin()
-- 3. Índice em product_id para queries do portal
-- 4. URL validation no RPC (trim + scheme http/https)
-- ============================================================

-- 1. Substituir policy de SELECT por acesso baseado em compra
DROP POLICY IF EXISTS "Tenant customers can view product_links" ON public.product_links;

CREATE POLICY "Purchasers can view product_links"
  ON public.product_links FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.id = product_links.product_id
        AND public.is_tenant_editor(p.tenant_id)
    )
    OR EXISTS (
      SELECT 1 FROM public.orders o
      JOIN public.customers c ON c.id = o.customer_id
      WHERE o.product_id = product_links.product_id
        AND c.user_id = auth.uid()
        AND o.status IN ('approved', 'completed')
    )
  );

-- 2. Editor policy: adicionar is_admin() (consistente com a RPC)
DROP POLICY IF EXISTS "Tenant editors can manage product_links" ON public.product_links;

CREATE POLICY "Tenant editors can manage product_links"
  ON public.product_links FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.id = product_links.product_id
        AND (public.is_tenant_editor(p.tenant_id) OR public.is_admin())
    )
  );

-- 3. Índice para queries por product_id + sort_order
CREATE INDEX IF NOT EXISTS idx_product_links_product_sort
  ON public.product_links (product_id, sort_order);

-- 4. Atualizar RPC com validação de URL (trim + scheme http/https)
CREATE OR REPLACE FUNCTION public.set_product_deliverable(
  p_product_id uuid,
  p_benefit text,
  p_asset_ids uuid[] DEFAULT NULL,
  p_course_ids uuid[] DEFAULT NULL,
  p_link_items jsonb[] DEFAULT NULL
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
  v_link_url text;
  v_item jsonb;
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
  IF p_benefit NOT IN ('files', 'courses', 'links') THEN
    RAISE EXCEPTION 'benefit must be files, courses or links';
  END IF;

  -- 5. Normalizar IDs (deduplicar, preservar ordem) — files/courses
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

  IF p_benefit = 'links' AND (p_link_items IS NULL OR cardinality(p_link_items) = 0) THEN
    RAISE EXCEPTION 'At least one link is required';
  END IF;

  IF p_benefit = 'links' AND cardinality(p_link_items) > 20 THEN
    RAISE EXCEPTION 'Maximum 20 links per product';
  END IF;

  -- 6b. Validar URLs dos links (trim + scheme http/https)
  IF p_benefit = 'links' THEN
    FOR v_item IN SELECT item FROM unnest(p_link_items) AS t(item) LOOP
      v_link_url := trim(v_item->>'url');
      IF v_link_url IS NULL OR v_link_url = '' THEN
        RAISE EXCEPTION 'Link URL cannot be empty';
      END IF;
      IF v_link_url !~ '^https?://' THEN
        RAISE EXCEPTION 'Link URL must start with http:// or https:// (got: %)', left(v_link_url, 50);
      END IF;
    END LOOP;
  END IF;

  -- 7. Aplicar links (INSERT-first-DELETE-second evita downgrade trigger)
  IF p_benefit = 'files' THEN
    INSERT INTO public.product_assets (product_id, asset_id, sort_order)
    SELECT p_product_id, asset_id, ord - 1
      FROM unnest(v_normalized_asset_ids) WITH ORDINALITY AS t(asset_id, ord)
    ON CONFLICT (product_id, asset_id) DO UPDATE SET sort_order = EXCLUDED.sort_order;

    DELETE FROM public.product_assets
     WHERE product_id = p_product_id
       AND asset_id != ALL(v_normalized_asset_ids);

    v_linked_count := cardinality(v_normalized_asset_ids);

    DELETE FROM public.product_courses WHERE product_id = p_product_id;
    DELETE FROM public.product_links  WHERE product_id = p_product_id;

  ELSIF p_benefit = 'courses' THEN
    INSERT INTO public.product_courses (product_id, course_id)
    SELECT p_product_id, course_id
      FROM unnest(v_normalized_course_ids) AS t(course_id)
    ON CONFLICT (product_id, course_id) DO NOTHING;

    DELETE FROM public.product_courses
     WHERE product_id = p_product_id
       AND course_id != ALL(v_normalized_course_ids);

    v_linked_count := cardinality(v_normalized_course_ids);

    DELETE FROM public.product_assets WHERE product_id = p_product_id;
    DELETE FROM public.product_links  WHERE product_id = p_product_id;

  ELSE -- links
    -- INSERT novos links (deduplica por URL, preserva ordem)
    -- trim() na URL para normalização
    INSERT INTO public.product_links (product_id, url, title, description, sort_order)
    SELECT
      p_product_id,
      trim(item->>'url'),
      trim(item->>'title'),
      NULLIF(trim(item->>'description'), ''),
      (ord - 1)
    FROM unnest(p_link_items) WITH ORDINALITY AS t(item, ord)
    ON CONFLICT (product_id, url) DO UPDATE
      SET title = EXCLUDED.title,
          description = EXCLUDED.description,
          sort_order = EXCLUDED.sort_order;

    DELETE FROM public.product_links
     WHERE product_id = p_product_id
       AND url NOT IN (
         SELECT trim(item->>'url') FROM unnest(p_link_items) AS t(item)
       );

    v_linked_count := cardinality(p_link_items);

    DELETE FROM public.product_assets  WHERE product_id = p_product_id;
    DELETE FROM public.product_courses WHERE product_id = p_product_id;
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
