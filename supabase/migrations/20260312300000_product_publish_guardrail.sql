-- ============================================================
-- Migration: Guardrail de publicação de produto
--
-- Impede publicação de produto sem deliverable configurado:
-- - benefit = 'courses' → precisa ter ao menos 1 product_courses
-- - benefit = 'files' → precisa ter ao menos 1 product_assets
-- - benefit IS NULL → não pode publicar
-- ============================================================

CREATE OR REPLACE FUNCTION public.validate_product_publish()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Só valida ao PUBLICAR (transição para 'published')
  IF NEW.status = 'published' AND (OLD.status IS NULL OR OLD.status != 'published') THEN
    IF NEW.benefit = 'courses' THEN
      IF NOT EXISTS (SELECT 1 FROM product_courses WHERE product_id = NEW.id) THEN
        RAISE EXCEPTION 'Produto de cursos precisa ter ao menos 1 curso vinculado para ser publicado';
      END IF;
    ELSIF NEW.benefit = 'files' THEN
      IF NOT EXISTS (SELECT 1 FROM product_assets WHERE product_id = NEW.id) THEN
        RAISE EXCEPTION 'Produto de arquivos precisa ter ao menos 1 arquivo vinculado para ser publicado';
      END IF;
    ELSIF NEW.benefit IS NULL THEN
      RAISE EXCEPTION 'Produto precisa ter um tipo de entrega definido para ser publicado';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_product_publish ON products;

CREATE TRIGGER trg_validate_product_publish
  BEFORE UPDATE ON products
  FOR EACH ROW
  EXECUTE FUNCTION validate_product_publish();
