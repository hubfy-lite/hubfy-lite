-- ============================================================
-- Seller async provider flow
--
-- When a "tenant_submitted" event is created, a pg_net trigger
-- fires an async HTTP call to the seller-provider-submit edge
-- function, which handles the Chargefy integration.
-- ============================================================

-- Enable pg_net for async HTTP calls from triggers
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- ============================================================
-- Trigger function: call seller-provider-submit on tenant_submitted
-- ============================================================
CREATE OR REPLACE FUNCTION public.on_tenant_submitted()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  _supabase_url text;
  _anon_key text;
BEGIN
  -- Only fire for tenant_submitted events
  IF NEW.event_type <> 'tenant_submitted' THEN
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

-- ============================================================
-- Trigger on seller_events
-- ============================================================
DROP TRIGGER IF EXISTS trg_seller_provider_submit ON public.seller_events;

CREATE TRIGGER trg_seller_provider_submit
  AFTER INSERT ON public.seller_events
  FOR EACH ROW
  EXECUTE FUNCTION public.on_tenant_submitted();

-- ============================================================
-- Insert vault secrets (supabase_url + anon key)
-- Placeholder values — filled by `npm run setup` after deploy.
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM vault.decrypted_secrets WHERE name = 'supabase_url') THEN
    PERFORM vault.create_secret(
      '',
      'supabase_url',
      'Supabase project URL for pg_net triggers — set via npm run setup'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM vault.decrypted_secrets WHERE name = 'supabase_anon_key') THEN
    PERFORM vault.create_secret(
      '',
      'supabase_anon_key',
      'Supabase anon key for pg_net triggers — set via npm run setup'
    );
  END IF;
END;
$$;
