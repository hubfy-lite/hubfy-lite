-- ============================================================
-- Fix: enforce_single_active_gateway() trigger
--
-- Bug: o filtro "id != NEW.id" causava erro
-- "ON CONFLICT DO UPDATE command cannot affect row a second time"
-- quando connect_integration() fazia upsert do mesmo provider.
--
-- No caminho INSERT ... ON CONFLICT, NEW.id é o UUID recém-gerado
-- (não o id do row existente), então o trigger UPDATE acertava
-- o row existente do mesmo provider, e o ON CONFLICT DO UPDATE
-- tentava atualizar esse mesmo row = erro do Postgres.
--
-- Fix: trocar "id != NEW.id" por "provider != NEW.provider".
-- Isso traduz a regra de negócio real: desativar OUTROS gateways,
-- não o próprio provider que está sendo upsertado.
-- ============================================================

CREATE OR REPLACE FUNCTION public.enforce_single_active_gateway()
RETURNS TRIGGER AS $$
DECLARE
  payment_providers TEXT[] := ARRAY['hotmart','kiwify','kirvano','lastlink'];
BEGIN
  -- Só aplica para providers de pagamento
  IF NOT (NEW.provider = ANY(payment_providers)) THEN
    RETURN NEW;
  END IF;

  -- Se está ativando, desativa os outros gateways do tenant
  IF NEW.status = 'active' THEN
    UPDATE public.tenant_integrations
    SET status = 'inactive', updated_at = now()
    WHERE tenant_id = NEW.tenant_id
      AND provider = ANY(payment_providers)
      AND provider != NEW.provider
      AND status = 'active';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
