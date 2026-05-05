-- ============================================================
-- Migration: Novo tipo de entregável "links"
--
-- 1. Tabela product_links
-- 2. RLS policies
-- 3. ALTER CHECK constraint em products.benefit
-- 4. Atualizar RPC set_product_deliverable (adicionar branch links)
-- 5. Atualizar trigger validate_product_activation
-- 6. Atualizar trigger prevent_product_benefit_change
-- 7. Atualizar trigger downgrade_active_product_on_empty_deliverables
-- 8. Trigger de downgrade para product_links
-- ============================================================

-- 1. Tabela product_links
CREATE TABLE public.product_links (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id  uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  url         text NOT NULL,
  title       text NOT NULL,
  description text,
  sort_order  integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE(product_id, url)
);

ALTER TABLE public.product_links ENABLE ROW LEVEL SECURITY;

-- 2. RLS policies (mesma abordagem de product_assets)
CREATE POLICY "Tenant editors can manage product_links"
  ON public.product_links FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.id = product_links.product_id
        AND public.is_tenant_editor(p.tenant_id)
    )
  );

CREATE POLICY "Tenant customers can view product_links"
  ON public.product_links FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.id = product_links.product_id
        AND public.is_tenant_customer(p.tenant_id)
    )
  );

-- 3. Alterar CHECK constraint para incluir 'links'
ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_benefit_check;
ALTER TABLE public.products ADD CONSTRAINT products_benefit_check
  CHECK (benefit IN ('files', 'courses', 'links'));

-- 4. Atualizar RPC set_product_deliverable
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
  v_link_item jsonb;
  v_link_url text;
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
    INSERT INTO public.product_links (product_id, url, title, description, sort_order)
    SELECT
      p_product_id,
      item->>'url',
      item->>'title',
      NULLIF(item->>'description', ''),
      (ord - 1)
    FROM unnest(p_link_items) WITH ORDINALITY AS t(item, ord)
    ON CONFLICT (product_id, url) DO UPDATE
      SET title = EXCLUDED.title,
          description = EXCLUDED.description,
          sort_order = EXCLUDED.sort_order;

    -- Coletar URLs dos novos links para deletar os que saíram
    DELETE FROM public.product_links
     WHERE product_id = p_product_id
       AND url NOT IN (
         SELECT item->>'url' FROM unnest(p_link_items) AS t(item)
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

-- 5. Atualizar trigger validate_product_activation
CREATE OR REPLACE FUNCTION public.validate_product_activation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status = 'active' AND (OLD.status IS NULL OR OLD.status != 'active') THEN
    IF NEW.benefit = 'courses' THEN
      IF NOT EXISTS (SELECT 1 FROM product_courses WHERE product_id = NEW.id) THEN
        RAISE EXCEPTION 'Produto de cursos precisa ter ao menos 1 curso vinculado para ser ativado';
      END IF;
    ELSIF NEW.benefit = 'files' THEN
      IF NOT EXISTS (SELECT 1 FROM product_assets WHERE product_id = NEW.id) THEN
        RAISE EXCEPTION 'Produto de arquivos precisa ter ao menos 1 arquivo vinculado para ser ativado';
      END IF;
    ELSIF NEW.benefit = 'links' THEN
      IF NOT EXISTS (SELECT 1 FROM product_links WHERE product_id = NEW.id) THEN
        RAISE EXCEPTION 'Produto de links precisa ter ao menos 1 link para ser ativado';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- 6. Atualizar trigger prevent_product_benefit_change
CREATE OR REPLACE FUNCTION public.prevent_product_benefit_change()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.benefit IS NOT DISTINCT FROM OLD.benefit THEN
    RETURN NEW;
  END IF;

  IF OLD.benefit IS NULL AND NEW.benefit IN ('files', 'courses', 'links') THEN
    IF NEW.benefit = 'files' THEN
      IF NOT EXISTS (SELECT 1 FROM product_assets WHERE product_id = NEW.id) THEN
        RAISE EXCEPTION 'Vincule ao menos 1 arquivo antes de definir o tipo de entrega';
      END IF;
    ELSIF NEW.benefit = 'courses' THEN
      IF NOT EXISTS (SELECT 1 FROM product_courses WHERE product_id = NEW.id) THEN
        RAISE EXCEPTION 'Vincule ao menos 1 curso antes de definir o tipo de entrega';
      END IF;
    ELSIF NEW.benefit = 'links' THEN
      IF NOT EXISTS (SELECT 1 FROM product_links WHERE product_id = NEW.id) THEN
        RAISE EXCEPTION 'Vincule ao menos 1 link antes de definir o tipo de entrega';
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'O tipo de entregável não pode ser alterado após a definição inicial';
END;
$$;

-- 7. Atualizar trigger downgrade_active_product_on_empty_deliverables
CREATE OR REPLACE FUNCTION public.downgrade_active_product_on_empty_deliverables()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_product_status public.product_status;
  v_benefit text;
  v_remaining int;
BEGIN
  SELECT p.status, p.benefit INTO v_product_status, v_benefit
  FROM products p WHERE p.id = OLD.product_id;

  IF v_product_status != 'active' THEN
    RETURN OLD;
  END IF;

  IF TG_TABLE_NAME = 'product_courses' AND v_benefit = 'courses' THEN
    SELECT count(*) INTO v_remaining
    FROM product_courses WHERE product_id = OLD.product_id AND id != OLD.id;
  ELSIF TG_TABLE_NAME = 'product_assets' AND v_benefit = 'files' THEN
    SELECT count(*) INTO v_remaining
    FROM product_assets WHERE product_id = OLD.product_id AND id != OLD.id;
  ELSIF TG_TABLE_NAME = 'product_links' AND v_benefit = 'links' THEN
    SELECT count(*) INTO v_remaining
    FROM product_links WHERE product_id = OLD.product_id AND id != OLD.id;
  ELSE
    RETURN OLD;
  END IF;

  IF v_remaining = 0 THEN
    UPDATE products SET status = 'draft' WHERE id = OLD.product_id;
  END IF;

  RETURN OLD;
END;
$$;

-- 8. Trigger de downgrade para product_links
CREATE TRIGGER trg_downgrade_on_empty_links
  AFTER DELETE ON public.product_links
  FOR EACH ROW
  EXECUTE FUNCTION public.downgrade_active_product_on_empty_deliverables();
