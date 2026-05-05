-- ============================================================
-- Migration: Email Logs
--
-- Sistema universal de log de emails enviados.
-- Registra todos os emails: acesso, convites, equipe, reconciliação.
-- Recebe atualizações de status via webhook da Resend.
-- ============================================================

-- Enum: tipo do email
CREATE TYPE public.email_log_type AS ENUM (
  'portal_access',
  'customer_invite',
  'access_granted',
  'team_invite',
  'reconciliation'
);

-- Enum: status do email (progressão)
CREATE TYPE public.email_log_status AS ENUM (
  'sent',
  'delivered',
  'opened',
  'clicked',
  'bounced',
  'complained',
  'failed'
);

-- Tabela principal
CREATE TABLE public.email_logs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  customer_id       UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  order_id          UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  user_id           UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  recipient_email   TEXT NOT NULL,
  subject           TEXT NOT NULL,
  email_type        public.email_log_type NOT NULL,
  status            public.email_log_status NOT NULL DEFAULT 'sent',
  resend_message_id TEXT,
  error_message     TEXT,
  metadata          JSONB DEFAULT '{}',

  sent_at           TIMESTAMPTZ DEFAULT now(),
  delivered_at      TIMESTAMPTZ,
  opened_at         TIMESTAMPTZ,
  clicked_at        TIMESTAMPTZ,
  bounced_at        TIMESTAMPTZ,
  complained_at     TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_email_logs_tenant      ON public.email_logs(tenant_id);
CREATE INDEX idx_email_logs_order       ON public.email_logs(order_id) WHERE order_id IS NOT NULL;
CREATE INDEX idx_email_logs_customer    ON public.email_logs(customer_id) WHERE customer_id IS NOT NULL;
CREATE INDEX idx_email_logs_resend_id   ON public.email_logs(resend_message_id) WHERE resend_message_id IS NOT NULL;
CREATE INDEX idx_email_logs_tenant_type ON public.email_logs(tenant_id, email_type);

-- Trigger updated_at
CREATE TRIGGER set_email_logs_updated_at
  BEFORE UPDATE ON public.email_logs
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- RLS (leitura para editors — inserts pelo service_role)
ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Editors can view email_logs"
  ON public.email_logs FOR SELECT
  USING (public.is_tenant_editor(tenant_id) OR public.is_admin());
