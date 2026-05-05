-- ─────────────────────────────────────────────────────────────────────────────
-- Tenant members: acesso automático a todos os cursos do tenant
--
-- Regra: qualquer user presente em tenant_users tem acesso implícito a todos
-- os cursos daquele tenant — sem precisar estar em course_customers.
--
-- Implementação: adicionar Caso 3 na função is_enrolled_in_course(), que é
-- usada pelas RLS policies de modules, lessons, lesson_videos, lesson_blocks,
-- lesson_assets e lesson_assets_link.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.is_enrolled_in_course(_course_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    -- Caso 1: acesso direto ao curso via course_customers (compra ou manual)
    SELECT 1
    FROM public.course_customers cc
    WHERE cc.course_id = _course_id
      AND cc.user_id = auth.uid()
  )
  OR EXISTS (
    -- Caso 2: curso em vitrine pública + user é customer do tenant (legado)
    SELECT 1
    FROM public.showcase_courses sc
    JOIN public.showcases s ON s.id = sc.showcase_id
    WHERE sc.course_id = _course_id
      AND s.is_public = true
      AND public.is_tenant_customer(s.tenant_id)
  )
  OR EXISTS (
    -- Caso 3: user é membro da equipe do tenant (tenant_users)
    -- → acesso automático a todos os cursos do tenant
    SELECT 1
    FROM public.tenant_users tu
    JOIN public.courses c ON c.tenant_id = tu.tenant_id
    WHERE c.id = _course_id
      AND tu.user_id = auth.uid()
  )
$$;
