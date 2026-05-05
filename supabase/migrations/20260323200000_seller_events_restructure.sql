-- ============================================================
-- Reestruturação da tabela seller_events
--
-- Mudanças:
--   - Adiciona: external_event_id, suborganization_id, event_io, response
--   - Remove: internal_status, error_message
--   - event_type agora usa nomes unificados (Chargefy + nossos)
--   - event_io: 'in' (recebido do provider) ou 'out' (enviado por nós)
-- ============================================================

-- 1. Adicionar novas colunas
ALTER TABLE public.seller_events
  ADD COLUMN IF NOT EXISTS external_event_id TEXT,
  ADD COLUMN IF NOT EXISTS suborganization_id TEXT,
  ADD COLUMN IF NOT EXISTS event_io TEXT,
  ADD COLUMN IF NOT EXISTS response JSONB;

-- 2. Constraint: event_io só aceita 'in' ou 'out'
ALTER TABLE public.seller_events
  ADD CONSTRAINT chk_seller_events_io CHECK (event_io IN ('in', 'out'));

-- 3. Remover colunas obsoletas
ALTER TABLE public.seller_events
  DROP COLUMN IF EXISTS internal_status,
  DROP COLUMN IF EXISTS error_message;

-- 4. Índices para consulta rápida
CREATE INDEX IF NOT EXISTS idx_seller_events_event_io
  ON public.seller_events (event_io);

CREATE INDEX IF NOT EXISTS idx_seller_events_external_event_id
  ON public.seller_events (external_event_id)
  WHERE external_event_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_seller_events_suborganization_id
  ON public.seller_events (suborganization_id)
  WHERE suborganization_id IS NOT NULL;

-- 5. Atualizar trigger pg_net: novo event_type é 'seller.submit'
CREATE OR REPLACE FUNCTION public.on_tenant_submitted()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  _supabase_url text;
  _anon_key text;
BEGIN
  -- Only fire for seller.submit events (out)
  IF NEW.event_type <> 'seller.submit' THEN
    RETURN NEW;
  END IF;

  -- Get secrets from vault
  SELECT decrypted_secret INTO _supabase_url
    FROM vault.decrypted_secrets WHERE name = 'supabase_url' LIMIT 1;
  SELECT decrypted_secret INTO _anon_key
    FROM vault.decrypted_secrets WHERE name = 'supabase_anon_key' LIMIT 1;

  -- Fire async HTTP call via pg_net (non-blocking)
  IF _supabase_url IS NOT NULL AND _anon_key IS NOT NULL THEN
    PERFORM net.http_post(
      url    := _supabase_url || '/functions/v1/seller-provider-submit',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || _anon_key
      ),
      body   := jsonb_build_object(
        'seller_id', NEW.seller_id,
        'tenant_id', NEW.tenant_id,
        'event_id',  NEW.id::text
      )
    );
  ELSE
    RAISE WARNING 'Vault secrets supabase_url/supabase_anon_key not found — skipping provider submit trigger';
  END IF;

  RETURN NEW;
END;
$$;
