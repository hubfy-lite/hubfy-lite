-- ============================================================
-- Sellers: conta de vendedor vinculada a um tenant
-- ============================================================

-- Enums
CREATE TYPE public.seller_status AS ENUM (
  'draft',
  'pending',
  'approved',
  'rejected',
  'disabled',
  'deleted'
);

CREATE TYPE public.seller_type AS ENUM (
  'individual',
  'business'
);

CREATE TYPE public.seller_document_category AS ENUM (
  'selfie',
  'cnh_full',
  'cnh_front',
  'cnh_back',
  'rg_front',
  'rg_back'
);

-- ============================================================
-- Tabela: sellers
-- ============================================================
CREATE TABLE public.sellers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  type            public.seller_type NOT NULL,
  status          public.seller_status NOT NULL DEFAULT 'draft',

  -- Dados pessoais (PF) / Dados do sócio (PJ)
  first_name      TEXT,
  last_name       TEXT,
  email           TEXT,
  phone_number    TEXT,
  taxpayer_id     TEXT,            -- CPF (11 dígitos, sem pontuação)
  birthdate       DATE,

  -- Negócio
  statement_descriptor TEXT,      -- nome fantasia (aparece na fatura)
  revenue         BIGINT,         -- renda/faturamento em centavos
  mcc             TEXT,           -- merchant category code

  -- Endereço pessoal (PF) / Endereço do sócio (PJ)
  address_line1           TEXT,
  address_line2           TEXT,
  address_line3           TEXT,
  address_neighborhood    TEXT,
  address_city            TEXT,
  address_state           TEXT,   -- UF (2 letras, ex: SP, RJ)
  address_postal_code     TEXT,   -- CEP (8 dígitos, sem hífen)
  address_country_code    TEXT DEFAULT 'BR',

  -- Dados da empresa (somente PJ)
  business_name           TEXT,   -- razão social
  ein                     TEXT,   -- CNPJ (14 dígitos, sem pontuação)
  business_phone          TEXT,
  business_email          TEXT,
  business_description    TEXT,
  business_website        TEXT,
  business_facebook       TEXT,
  business_twitter        TEXT,
  business_opening_date   DATE,

  -- Endereço da empresa (somente PJ)
  business_address_line1          TEXT,
  business_address_line2          TEXT,
  business_address_line3          TEXT,
  business_address_neighborhood   TEXT,
  business_address_city           TEXT,
  business_address_state          TEXT,
  business_address_postal_code    TEXT,
  business_address_country_code   TEXT DEFAULT 'BR',

  -- Controle externo
  external_seller_id  TEXT,       -- ID do seller no provedor de pagamento

  -- Timestamps de fluxo
  submitted_at    TIMESTAMPTZ,
  approved_at     TIMESTAMPTZ,
  rejected_at     TIMESTAMPTZ,
  rejection_reason TEXT,

  -- Audit
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      UUID REFERENCES auth.users(id),

  -- 1 seller por tenant
  CONSTRAINT sellers_tenant_id_unique UNIQUE (tenant_id)
);

-- Índices
CREATE INDEX idx_sellers_status ON public.sellers (status);
CREATE INDEX idx_sellers_external_id ON public.sellers (external_seller_id) WHERE external_seller_id IS NOT NULL;

-- Trigger: updated_at automático
CREATE OR REPLACE FUNCTION public.update_sellers_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_sellers_updated_at
  BEFORE UPDATE ON public.sellers
  FOR EACH ROW EXECUTE FUNCTION public.update_sellers_updated_at();

-- ============================================================
-- Tabela: seller_documents (documentos KYC)
-- ============================================================
CREATE TABLE public.seller_documents (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id         UUID NOT NULL REFERENCES public.sellers(id) ON DELETE CASCADE,
  category          public.seller_document_category NOT NULL,
  bucket            TEXT NOT NULL DEFAULT 'seller-docs',
  object_path       TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  mime_type         TEXT NOT NULL,
  size_bytes        INTEGER,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_seller_documents_seller_id ON public.seller_documents (seller_id);

-- ============================================================
-- Tabela: seller_events (log de webhook, somente superadmin)
-- ============================================================
CREATE TABLE public.seller_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id       UUID REFERENCES public.sellers(id) ON DELETE SET NULL,
  tenant_id       UUID REFERENCES public.tenants(id) ON DELETE SET NULL,
  event_type      TEXT NOT NULL,
  external_status TEXT,
  internal_status TEXT,
  raw_payload     JSONB,
  error_message   TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_seller_events_seller_id ON public.seller_events (seller_id);
CREATE INDEX idx_seller_events_tenant_id ON public.seller_events (tenant_id);

-- ============================================================
-- RLS: sellers
-- ============================================================
ALTER TABLE public.sellers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Editors can view their tenant seller"
  ON public.sellers FOR SELECT
  USING (public.is_tenant_editor(tenant_id) OR public.is_admin());

CREATE POLICY "Editors can create seller for their tenant"
  ON public.sellers FOR INSERT
  WITH CHECK (public.is_tenant_editor(tenant_id));

CREATE POLICY "Editors can update their tenant seller"
  ON public.sellers FOR UPDATE
  USING (public.is_tenant_editor(tenant_id) OR public.is_admin());

-- Não permitir DELETE via RLS (soft delete via status = 'deleted')

-- ============================================================
-- RLS: seller_documents
-- ============================================================
ALTER TABLE public.seller_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Editors can view their seller documents"
  ON public.seller_documents FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.sellers s
      WHERE s.id = seller_id
        AND (public.is_tenant_editor(s.tenant_id) OR public.is_admin())
    )
  );

CREATE POLICY "Editors can insert seller documents"
  ON public.seller_documents FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.sellers s
      WHERE s.id = seller_id
        AND public.is_tenant_editor(s.tenant_id)
    )
  );

CREATE POLICY "Editors can delete their seller documents"
  ON public.seller_documents FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.sellers s
      WHERE s.id = seller_id
        AND public.is_tenant_editor(s.tenant_id)
    )
  );

-- ============================================================
-- RLS: seller_events (somente superadmin)
-- ============================================================
ALTER TABLE public.seller_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Only admins can view seller events"
  ON public.seller_events FOR SELECT
  USING (public.is_admin());

CREATE POLICY "Service role can insert seller events"
  ON public.seller_events FOR INSERT
  WITH CHECK (true);

-- ============================================================
-- Storage: bucket seller-docs (privado)
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('seller-docs', 'seller-docs', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Tenant editors can upload seller docs"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'seller-docs'
    AND auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM public.tenant_users tm
      WHERE tm.user_id = auth.uid()
        AND tm.role IN ('owner', 'editor')
        AND tm.tenant_id::text = (storage.foldername(name))[2]
    )
  );

CREATE POLICY "Tenant editors and admins can view seller docs"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'seller-docs'
    AND (
      public.is_admin()
      OR (
        auth.role() = 'authenticated'
        AND EXISTS (
          SELECT 1 FROM public.tenant_users tm
          WHERE tm.user_id = auth.uid()
            AND tm.role IN ('owner', 'editor')
            AND tm.tenant_id::text = (storage.foldername(name))[2]
        )
      )
    )
  );

CREATE POLICY "Tenant editors can delete seller docs"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'seller-docs'
    AND auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM public.tenant_users tm
      WHERE tm.user_id = auth.uid()
        AND tm.role IN ('owner', 'editor')
        AND tm.tenant_id::text = (storage.foldername(name))[2]
    )
  );

-- ============================================================
-- RPC: get_superadmin_sellers (para painel superadmin)
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_superadmin_sellers(
  p_search TEXT DEFAULT NULL,
  p_status TEXT DEFAULT NULL,
  p_page INTEGER DEFAULT 0,
  p_page_size INTEGER DEFAULT 50
)
RETURNS TABLE (
  id UUID,
  tenant_id UUID,
  tenant_name TEXT,
  tenant_slug TEXT,
  type public.seller_type,
  status public.seller_status,
  first_name TEXT,
  last_name TEXT,
  email TEXT,
  taxpayer_id TEXT,
  business_name TEXT,
  ein TEXT,
  submitted_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ,
  rejected_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  total_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_offset INTEGER := p_page * p_page_size;
  v_search TEXT := NULLIF(TRIM(p_search), '');
  v_status public.seller_status := NULLIF(TRIM(p_status), '')::public.seller_status;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  RETURN QUERY
  SELECT
    s.id,
    s.tenant_id,
    t.name AS tenant_name,
    t.slug AS tenant_slug,
    s.type,
    s.status,
    s.first_name,
    s.last_name,
    s.email,
    s.taxpayer_id,
    s.business_name,
    s.ein,
    s.submitted_at,
    s.approved_at,
    s.rejected_at,
    s.created_at,
    COUNT(*) OVER() AS total_count
  FROM public.sellers s
  JOIN public.tenants t ON t.id = s.tenant_id
  WHERE
    (v_search IS NULL OR (
      s.first_name ILIKE '%' || v_search || '%'
      OR s.last_name ILIKE '%' || v_search || '%'
      OR s.email ILIKE '%' || v_search || '%'
      OR s.taxpayer_id ILIKE '%' || v_search || '%'
      OR s.business_name ILIKE '%' || v_search || '%'
      OR s.ein ILIKE '%' || v_search || '%'
      OR t.name ILIKE '%' || v_search || '%'
    ))
    AND (v_status IS NULL OR s.status = v_status)
  ORDER BY s.created_at DESC
  LIMIT p_page_size
  OFFSET v_offset;
END;
$$;
