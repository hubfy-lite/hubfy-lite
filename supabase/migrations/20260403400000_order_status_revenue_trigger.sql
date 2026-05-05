-- Trigger: ajuste automático de revenue ao mudar status de uma order.
--
-- REVENUE_ACTIVE_STATUSES = ('approved', 'completed')
-- Quando o status muda de ativo → inativo: decrementa customer revenue.
-- Quando o status muda de inativo → ativo: incrementa customer revenue.
-- Isso garante que mudanças manuais de status (admin) também reflitam no revenue,
-- não apenas as vindas do webhook pipeline.

CREATE OR REPLACE FUNCTION public.adjust_customer_revenue_on_order_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  active_statuses text[] := ARRAY['approved', 'completed'];
  was_active boolean;
  is_active boolean;
BEGIN
  -- Só processa se status realmente mudou
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  was_active := OLD.status::text = ANY(active_statuses);
  is_active  := NEW.status::text = ANY(active_statuses);

  -- Sem mudança na "atividade" do revenue
  IF was_active = is_active THEN
    RETURN NEW;
  END IF;

  IF was_active AND NOT is_active THEN
    -- Saiu de status ativo → decrementa
    UPDATE customers
    SET total_revenue_cents = GREATEST(total_revenue_cents - COALESCE(NEW.unit_amount, 0), 0),
        updated_at = now()
    WHERE id = NEW.customer_id;
  ELSIF NOT was_active AND is_active THEN
    -- Entrou em status ativo → incrementa
    UPDATE customers
    SET total_revenue_cents = total_revenue_cents + COALESCE(NEW.unit_amount, 0),
        updated_at = now()
    WHERE id = NEW.customer_id;
  END IF;

  RETURN NEW;
END;
$$;

-- Trigger na tabela orders (BEFORE UPDATE para garantir consistência)
DROP TRIGGER IF EXISTS trg_adjust_customer_revenue ON orders;
CREATE TRIGGER trg_adjust_customer_revenue
  BEFORE UPDATE OF status ON orders
  FOR EACH ROW
  EXECUTE FUNCTION adjust_customer_revenue_on_order_status();
