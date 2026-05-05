-- ─────────────────────────────────────────────────────────────────────────────
-- Permite que qualquer usuário autenticado leia tenant_settings
-- via JOIN em queries de cursos/aulas.
--
-- Contexto: a policy anterior (tenant_settings_select_member) exige
-- tenant_users, impedindo que customers leiam branding, player config,
-- video_progress_tracking_enabled, etc. Isso quebra:
--   1. Ícone/cores na page do curso e aula
--   2. Progresso de vídeo (flag video_progress_tracking_enabled)
--   3. Proteção de vídeo (flag video_protection_enabled)
--
-- Solução: adicionar policy que permite SELECT para qualquer
-- usuário autenticado que tenha acesso ao curso do tenant
-- (via course_customers ou tenant_users).
-- ─────────────────────────────────────────────────────────────────────────────

-- Policy para customers: pode ler tenant_settings do tenant onde tem curso
CREATE POLICY "tenant_settings_select_course_customer"
  ON public.tenant_settings
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.course_customers cc
      JOIN public.courses c ON c.id = cc.course_id
      WHERE c.tenant_id = tenant_settings.tenant_id
        AND cc.user_id = auth.uid()
    )
  );
