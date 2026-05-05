-- ============================================================
-- Migration: Relaxar ativação de produto (benefit opcional)
--
-- 1. validate_product_activation  — permite benefit IS NULL
-- 2. prevent_product_benefit_change — valida conteúdo ao setar benefit
-- 3. configure_product_deliverable — aceita qualquer status
-- ============================================================

-- 1. Relaxar validação de ativação: benefit IS NULL é permitido
CREATE OR REPLACE FUNCTION public.validate_product_activation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Só valida ao ATIVAR (transição para 'active')
  IF NEW.status = 'active' AND (OLD.status IS NULL OR OLD.status != 'active') THEN
    IF NEW.benefit = 'courses' THEN
      IF NOT EXISTS (SELECT 1 FROM product_courses WHERE product_id = NEW.id) THEN
        RAISE EXCEPTION 'Produto de cursos precisa ter ao menos 1 curso vinculado para ser ativado';
      END IF;
    ELSIF NEW.benefit = 'files' THEN
      IF NOT EXISTS (SELECT 1 FROM product_assets WHERE product_id = NEW.id) THEN
        RAISE EXCEPTION 'Produto de arquivos precisa ter ao menos 1 arquivo vinculado para ser ativado';
      END IF;
    END IF;
    -- benefit IS NULL → ativação permitida (produto sem entregável interno)
  END IF;
  RETURN NEW;
END;
$$;

-- 2. Fechar brecha: ao mudar benefit de NULL → tipo, exigir conteúdo vinculado
CREATE OR REPLACE FUNCTION public.prevent_product_benefit_change()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Sem mudança no benefit → ok
  IF NEW.benefit IS NOT DISTINCT FROM OLD.benefit THEN
    RETURN NEW;
  END IF;

  -- Transição NULL → tipo válido: verificar conteúdo vinculado
  IF OLD.benefit IS NULL AND NEW.benefit IN ('files', 'courses') THEN
    IF NEW.benefit = 'files' THEN
      IF NOT EXISTS (SELECT 1 FROM product_assets WHERE product_id = NEW.id) THEN
        RAISE EXCEPTION 'Vincule ao menos 1 arquivo antes de definir o tipo de entrega';
      END IF;
    ELSIF NEW.benefit = 'courses' THEN
      IF NOT EXISTS (SELECT 1 FROM product_courses WHERE product_id = NEW.id) THEN
        RAISE EXCEPTION 'Vincule ao menos 1 curso antes de definir o tipo de entrega';
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  -- Qualquer outra transição (files→courses, courses→files, tipo→NULL) bloqueada
  RAISE EXCEPTION 'O tipo de entregável não pode ser alterado após a definição inicial';
END;
$$;

-- 3. Liberar configure_product_deliverable para qualquer status (não só draft)
CREATE OR REPLACE FUNCTION public.configure_product_deliverable(
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
  v_linked_count int := 0;
  v_normalized_asset_ids uuid[] := ARRAY[]::uuid[];
  v_normalized_course_ids uuid[] := ARRAY[]::uuid[];
BEGIN
  SELECT id, tenant_id, status, benefit
    INTO v_product
    FROM public.products
   WHERE id = p_product_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Product not found';
  END IF;

  IF NOT public.is_tenant_editor(v_product.tenant_id) AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  -- Removido: check de status = 'draft' — configuração permitida em qualquer status

  IF v_product.benefit IS NOT NULL THEN
    RAISE EXCEPTION 'Product already has a configured deliverable';
  END IF;

  IF p_benefit NOT IN ('files', 'courses') THEN
    RAISE EXCEPTION 'benefit must be files or courses';
  END IF;

  SELECT COALESCE(array_agg(asset_id ORDER BY ord), ARRAY[]::uuid[])
    INTO v_normalized_asset_ids
    FROM (
      SELECT asset_id, MIN(ord) AS ord
        FROM unnest(COALESCE(p_asset_ids, ARRAY[]::uuid[])) WITH ORDINALITY AS t(asset_id, ord)
       WHERE asset_id IS NOT NULL
       GROUP BY asset_id
    ) normalized_assets;

  SELECT COALESCE(array_agg(course_id ORDER BY ord), ARRAY[]::uuid[])
    INTO v_normalized_course_ids
    FROM (
      SELECT course_id, MIN(ord) AS ord
        FROM unnest(COALESCE(p_course_ids, ARRAY[]::uuid[])) WITH ORDINALITY AS t(course_id, ord)
       WHERE course_id IS NOT NULL
       GROUP BY course_id
    ) normalized_courses;

  IF p_benefit = 'files' AND cardinality(v_normalized_asset_ids) = 0 THEN
    RAISE EXCEPTION 'At least one asset must be linked for files deliverables';
  END IF;

  IF p_benefit = 'courses' AND cardinality(v_normalized_course_ids) = 0 THEN
    RAISE EXCEPTION 'At least one course must be linked for courses deliverables';
  END IF;

  DELETE FROM public.product_assets
   WHERE product_id = p_product_id;

  DELETE FROM public.product_courses
   WHERE product_id = p_product_id;

  IF p_benefit = 'files' THEN
    INSERT INTO public.product_assets (product_id, asset_id, sort_order)
    SELECT p_product_id, asset_id, ord - 1
      FROM unnest(v_normalized_asset_ids) WITH ORDINALITY AS t(asset_id, ord);

    GET DIAGNOSTICS v_linked_count = ROW_COUNT;
  ELSE
    INSERT INTO public.product_courses (product_id, course_id)
    SELECT p_product_id, course_id
      FROM unnest(v_normalized_course_ids) AS t(course_id);

    GET DIAGNOSTICS v_linked_count = ROW_COUNT;
  END IF;

  UPDATE public.products
     SET benefit = p_benefit
   WHERE id = p_product_id;

  RETURN jsonb_build_object(
    'benefit', p_benefit,
    'linked_count', v_linked_count
  );
END;
$$;
