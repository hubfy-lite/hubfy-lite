-- ─────────────────────────────────────────────────────────────────────────────
-- Fix 1: Remove UNIQUE constraint de lesson_videos.gumlet_asset_id
--        O mesmo vídeo pode (e deve poder) ser usado em múltiplas aulas.
-- Fix 2: Re-aplica is_enrolled_in_course com Caso 3 (tenant_users)
--        Garante que membros da equipe vejam vídeos das aulas.
-- ─────────────────────────────────────────────────────────────────────────────

-- ════════════════════════════════════════════════════════════
-- 1. Remover UNIQUE INDEX de lesson_videos.gumlet_asset_id
-- ════════════════════════════════════════════════════════════

DROP INDEX IF EXISTS public.idx_lesson_videos_gumlet_asset_id;

-- ════════════════════════════════════════════════════════════
-- 2. Re-aplicar is_enrolled_in_course com Caso 3 (idempotente)
--    Caso não esteja aplicado em produção ainda.
-- ════════════════════════════════════════════════════════════

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
