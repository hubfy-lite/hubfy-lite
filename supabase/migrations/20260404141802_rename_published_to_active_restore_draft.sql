-- ============================================================
-- Migration: Renomear published → active e restaurar draft
--
-- 1. Renomeia valor do enum product_status: published → active
-- 2. Altera default de products.status para 'draft'
-- 3. Recria RLS policy com nome e valor atualizados
-- 4. Recria trigger de validação com nome e mensagens atualizadas
-- ============================================================

-- 1. Renomear valor do enum
ALTER TYPE public.product_status RENAME VALUE 'published' TO 'active';

-- 2. Alterar default para draft (produto criado começa como rascunho)
ALTER TABLE public.products
  ALTER COLUMN status SET DEFAULT 'draft';

-- 3. Recriar RLS policy
DROP POLICY IF EXISTS "Published products are viewable by tenant customers" ON public.products;

CREATE POLICY "Active products are viewable by tenant customers"
  ON public.products FOR SELECT
  USING (status = 'active' AND public.is_tenant_customer(tenant_id));

-- 4. Recriar trigger function com nome e mensagens atualizados
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
    ELSIF NEW.benefit IS NULL THEN
      RAISE EXCEPTION 'Produto precisa ter um tipo de entrega definido para ser ativado';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Dropar trigger antigo e criar novo
DROP TRIGGER IF EXISTS trg_validate_product_publish ON products;
DROP FUNCTION IF EXISTS public.validate_product_publish();

CREATE TRIGGER trg_validate_product_activation
  BEFORE UPDATE ON products
  FOR EACH ROW
  EXECUTE FUNCTION validate_product_activation();

-- 5. Auto-downgrade para draft quando último deliverable é removido de produto ativo
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

  -- Contar deliverables restantes do mesmo tipo
  IF TG_TABLE_NAME = 'product_courses' AND v_benefit = 'courses' THEN
    SELECT count(*) INTO v_remaining
    FROM product_courses WHERE product_id = OLD.product_id AND id != OLD.id;
  ELSIF TG_TABLE_NAME = 'product_assets' AND v_benefit = 'files' THEN
    SELECT count(*) INTO v_remaining
    FROM product_assets WHERE product_id = OLD.product_id AND id != OLD.id;
  ELSE
    RETURN OLD;
  END IF;

  IF v_remaining = 0 THEN
    UPDATE products SET status = 'draft' WHERE id = OLD.product_id;
  END IF;

  RETURN OLD;
END;
$$;

CREATE TRIGGER trg_downgrade_on_empty_courses
  AFTER DELETE ON product_courses
  FOR EACH ROW
  EXECUTE FUNCTION downgrade_active_product_on_empty_deliverables();

CREATE TRIGGER trg_downgrade_on_empty_assets
  AFTER DELETE ON product_assets
  FOR EACH ROW
  EXECUTE FUNCTION downgrade_active_product_on_empty_deliverables();
