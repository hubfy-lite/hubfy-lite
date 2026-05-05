-- ============================================================
-- Migration: Eliminar enrollments — controle de acesso por vitrine
--
-- O acesso a cursos agora é determinado por showcase_customers
-- (vitrine privada) ou is_public + is_tenant_customer (vitrine pública).
-- A tabela enrollments é removida.
-- ============================================================

-- 1. Recriar is_enrolled_in_course() — agora checa via showcases
--    As 7 RLS policies que usam essa function continuam funcionando
--    sem nenhuma alteração (modules, lessons, lesson_progress,
--    lesson_blocks, lesson_assets, lesson_videos, lesson_assets_link).
CREATE OR REPLACE FUNCTION public.is_enrolled_in_course(_course_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    -- Caso 1: user está em showcase_customers de alguma vitrine que contém o curso
    SELECT 1
    FROM public.showcase_courses sc
    JOIN public.showcase_customers scust ON scust.showcase_id = sc.showcase_id
    WHERE sc.course_id = _course_id
      AND scust.user_id = auth.uid()
  )
  OR EXISTS (
    -- Caso 2: curso está em vitrine pública e user é customer do tenant
    SELECT 1
    FROM public.showcase_courses sc
    JOIN public.showcases s ON s.id = sc.showcase_id
    WHERE sc.course_id = _course_id
      AND s.is_public = true
      AND public.is_tenant_customer(s.tenant_id)
  )
$$;

-- 2. Dropar tabela enrollments (CASCADE remove indexes, constraints, policies)
DROP TABLE IF EXISTS public.enrollments CASCADE;

-- 3. Dropar function legada (alias antigo de quando products existia)
DROP FUNCTION IF EXISTS public.is_enrolled(UUID);
