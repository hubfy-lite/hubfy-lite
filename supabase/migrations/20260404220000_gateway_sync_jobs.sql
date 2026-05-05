-- ============================================================
-- Gateway Sync Jobs
-- Rastreia importações de dados do gateway ativo (products, customers, orders).
-- Começa com suporte a Products via API da Hotmart.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.gateway_sync_jobs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  integration_id UUID NOT NULL REFERENCES public.tenant_integrations(id) ON DELETE CASCADE,
  provider    TEXT NOT NULL,
  resource_type TEXT NOT NULL CHECK (resource_type IN ('products', 'customers', 'orders')),
  status      TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed')),
  total_items     INT,
  processed_items INT NOT NULL DEFAULT 0,
  created_count   INT NOT NULL DEFAULT 0,
  updated_count   INT NOT NULL DEFAULT 0,
  skipped_count   INT NOT NULL DEFAULT 0,
  error_count     INT NOT NULL DEFAULT 0,
  errors          JSONB NOT NULL DEFAULT '[]'::jsonb,
  params          JSONB NOT NULL DEFAULT '{}'::jsonb,
  started_by  UUID REFERENCES auth.users(id),
  started_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índice para buscar jobs recentes por tenant + resource
CREATE INDEX idx_sync_jobs_tenant_resource
  ON public.gateway_sync_jobs(tenant_id, resource_type, created_at DESC);

-- Garantia real de concorrência: no máximo 1 job running por tenant + resource_type
CREATE UNIQUE INDEX idx_sync_jobs_one_running
  ON public.gateway_sync_jobs(tenant_id, resource_type)
  WHERE status = 'running';

-- ─── RLS ───────────────────────────────────────────────────

ALTER TABLE public.gateway_sync_jobs ENABLE ROW LEVEL SECURITY;

-- Editors podem ver e criar jobs do seu tenant
CREATE POLICY "sync_jobs_editor_select"
  ON public.gateway_sync_jobs FOR SELECT
  USING (public.is_tenant_editor(tenant_id) OR public.is_admin());

CREATE POLICY "sync_jobs_editor_insert"
  ON public.gateway_sync_jobs FOR INSERT
  WITH CHECK (public.is_tenant_editor(tenant_id) OR public.is_admin());

-- Somente service role pode atualizar (edge function atualiza progresso)
CREATE POLICY "sync_jobs_service_role_update"
  ON public.gateway_sync_jobs FOR UPDATE
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
