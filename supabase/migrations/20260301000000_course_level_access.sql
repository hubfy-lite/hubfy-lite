-- ══════════════════════════════════════════════════════════════
-- Migração: Acesso por Vitrine → Acesso por Curso
--
-- Produtos passam a dar acesso a cursos individuais (não vitrines).
-- Vitrines continuam como organização visual.
-- ══════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────
-- 1. Criar tabela product_courses (substitui product_showcases)
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.product_courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(product_id, course_id)
);

CREATE INDEX IF NOT EXISTS idx_product_courses_product ON public.product_courses(product_id);
CREATE INDEX IF NOT EXISTS idx_product_courses_course ON public.product_courses(course_id);

-- Trigger: product e course devem pertencer ao mesmo tenant
CREATE OR REPLACE FUNCTION public.validate_product_course_tenant()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_product_tenant UUID;
  v_course_tenant UUID;
BEGIN
  SELECT tenant_id INTO v_product_tenant FROM public.products WHERE id = NEW.product_id;
  SELECT tenant_id INTO v_course_tenant FROM public.courses WHERE id = NEW.course_id;

  IF v_product_tenant IS DISTINCT FROM v_course_tenant THEN
    RAISE EXCEPTION 'Product and course must belong to the same tenant';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_product_course_tenant
  BEFORE INSERT OR UPDATE ON public.product_courses
  FOR EACH ROW EXECUTE FUNCTION public.validate_product_course_tenant();

-- RLS
ALTER TABLE public.product_courses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Editors can manage product_courses"
  ON public.product_courses FOR ALL
  USING (
    public.is_tenant_editor(public.get_product_tenant(product_id))
    OR public.is_admin()
  );

CREATE POLICY "Customers can view product_courses"
  ON public.product_courses FOR SELECT
  USING (
    public.is_tenant_customer(public.get_product_tenant(product_id))
  );

-- ─────────────────────────────────────────────
-- 2. Criar tabela course_customers (substitui showcase_customers)
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.course_customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(course_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_course_customers_course ON public.course_customers(course_id);
CREATE INDEX IF NOT EXISTS idx_course_customers_user ON public.course_customers(user_id);

-- RLS
ALTER TABLE public.course_customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Editors can manage course_customers"
  ON public.course_customers FOR ALL
  USING (
    public.is_tenant_editor(public.get_course_tenant(course_id))
    OR public.is_admin()
  );

CREATE POLICY "Users can view own course access"
  ON public.course_customers FOR SELECT
  USING (user_id = auth.uid());

-- ─────────────────────────────────────────────
-- 3. Migrar dados existentes
-- ─────────────────────────────────────────────

-- product_showcases → product_courses
INSERT INTO public.product_courses (product_id, course_id)
SELECT DISTINCT ps.product_id, sc.course_id
FROM public.product_showcases ps
JOIN public.showcase_courses sc ON sc.showcase_id = ps.showcase_id
ON CONFLICT (product_id, course_id) DO NOTHING;

-- showcase_customers → course_customers
INSERT INTO public.course_customers (course_id, user_id)
SELECT DISTINCT sc.course_id, scust.user_id
FROM public.showcase_customers scust
JOIN public.showcase_courses sc ON sc.showcase_id = scust.showcase_id
ON CONFLICT (course_id, user_id) DO NOTHING;

-- ─────────────────────────────────────────────
-- 4. Reescrever is_enrolled_in_course()
-- ─────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.is_enrolled_in_course(_course_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    -- Caso 1: acesso direto ao curso via course_customers
    SELECT 1
    FROM public.course_customers cc
    WHERE cc.course_id = _course_id
      AND cc.user_id = auth.uid()
  )
  OR EXISTS (
    -- Caso 2: curso em vitrine pública + user é customer do tenant
    SELECT 1
    FROM public.showcase_courses sc
    JOIN public.showcases s ON s.id = sc.showcase_id
    WHERE sc.course_id = _course_id
      AND s.is_public = true
      AND public.is_tenant_customer(s.tenant_id)
  )
$$;

-- ─────────────────────────────────────────────
-- 5. Reescrever can_view_showcase()
-- ─────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.can_view_showcase(_showcase_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.showcases s
    WHERE s.id = _showcase_id
      AND (
        public.is_tenant_editor(s.tenant_id)
        OR public.is_admin()
        OR (
          public.is_tenant_member(s.tenant_id)
          AND (
            s.is_public = true
            OR EXISTS (
              -- User tem acesso a pelo menos 1 curso desta vitrine
              SELECT 1
              FROM public.showcase_courses sc
              JOIN public.course_customers cc ON cc.course_id = sc.course_id
              WHERE sc.showcase_id = s.id
                AND cc.user_id = auth.uid()
            )
          )
        )
      )
  )
$$;

-- ─────────────────────────────────────────────
-- 6. Atualizar benefit: 'showcase' → 'courses'
-- ─────────────────────────────────────────────

-- Primeiro atualizar dados, depois trocar constraint
UPDATE public.products SET benefit = 'courses' WHERE benefit = 'showcase';

ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_benefit_check;
ALTER TABLE public.products ADD CONSTRAINT products_benefit_check
  CHECK (benefit IN ('files', 'courses'));
