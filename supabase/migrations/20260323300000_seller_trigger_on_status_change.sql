-- ============================================================
-- Move trigger do seller_events para sellers table
--
-- O trigger agora dispara quando sellers.status muda para 'pending',
-- em vez de depender de um evento na tabela seller_events.
-- A tabela seller_events é exclusiva para comunicação Hubfy ↔ Chargefy.
-- ============================================================

-- 1. Remove trigger antigo da tabela seller_events
DROP TRIGGER IF EXISTS trg_seller_provider_submit ON public.seller_events;

-- 2. Nova trigger function: dispara quando status muda para 'pending'
CREATE OR REPLACE FUNCTION public.on_seller_status_pending()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  _supabase_url text;
  _anon_key text;
BEGIN
  -- Only fire when status changes TO 'pending' (from draft or rejected)
  IF NEW.status <> 'pending' THEN
    RETURN NEW;
  END IF;

  -- Skip if status didn't actually change
  IF OLD.status = NEW.status THEN
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
        'seller_id', NEW.id::text,
        'tenant_id', NEW.tenant_id::text
      )
    );
  ELSE
    RAISE WARNING 'Vault secrets not found — skipping provider submit trigger';
  END IF;

  RETURN NEW;
END;
$$;

-- 3. Novo trigger na tabela sellers
CREATE TRIGGER trg_seller_provider_submit
  AFTER UPDATE ON public.sellers
  FOR EACH ROW
  EXECUTE FUNCTION public.on_seller_status_pending();

-- 4. Remover function antiga (não mais usada)
DROP FUNCTION IF EXISTS public.on_tenant_submitted();
