-- ============================================================
-- Migration: Centralizar grant/revoke de acesso em DB triggers
--
-- 1. Trigger handle_order_access (orders) — grant/revoke course_customers
-- 2. Trigger handle_customer_user_link (customers) — grant pendente ao vincular user_id
-- 3. RPC resolve_portal_customer — vincular customer órfão ao auth.user logado
-- 4. Atualizar get_customer_purchased_products — aceitar status 'approved'
-- 5. Atualizar handle_new_user — reconciliar customer por email
-- 6. Tabela portal_auth_requests — rate limiting do portal login
-- ============================================================

-- ════════════════════════════════════════════════════════════
-- 1. TRIGGER handle_order_access (tabela orders)
--    Grant quando status → approved/completed
--    Revoke quando status → cancelled/refunded/chargeback (vindo de approved/completed)
-- ════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.handle_order_access()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_user_id uuid;
  v_old_is_active boolean := false;
  v_new_is_active boolean := false;
BEGIN
  -- Determinar se old/new status são "ativos" (concedem acesso)
  IF TG_OP = 'UPDATE' THEN
    v_old_is_active := OLD.status IN ('approved', 'completed');
  END IF;
  v_new_is_active := NEW.status IN ('approved', 'completed');

  -- Se não houve mudança relevante, sair
  IF TG_OP = 'UPDATE' AND v_old_is_active = v_new_is_active THEN
    RETURN NEW;
  END IF;

  -- Buscar user_id do customer
  SELECT c.user_id INTO v_user_id
  FROM customers c WHERE c.id = NEW.customer_id;

  -- Se customer ainda não tem user_id, sair (trigger 2 cuida depois)
  IF v_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF v_new_is_active AND NOT v_old_is_active THEN
    -- ── GRANT: inserir course_customers para cursos do produto ──
    INSERT INTO course_customers (course_id, user_id)
    SELECT pc.course_id, v_user_id
    FROM product_courses pc
    WHERE pc.product_id = NEW.product_id
    ON CONFLICT (course_id, user_id) DO NOTHING;

  ELSIF NOT v_new_is_active AND v_old_is_active THEN
    -- ── REVOKE: remover course_customers, protegendo cursos de outras orders ativas ──
    DELETE FROM course_customers cc
    WHERE cc.user_id = v_user_id
      AND cc.course_id IN (
        SELECT pc.course_id FROM product_courses pc WHERE pc.product_id = NEW.product_id
      )
      AND cc.course_id NOT IN (
        SELECT pc2.course_id
        FROM orders o2
        JOIN product_courses pc2 ON pc2.product_id = o2.product_id
        WHERE o2.customer_id = NEW.customer_id
          AND o2.id != NEW.id
          AND o2.status IN ('approved', 'completed')
      );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_handle_order_access ON public.orders;
CREATE TRIGGER trg_handle_order_access
  AFTER INSERT OR UPDATE OF status ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_order_access();

-- ════════════════════════════════════════════════════════════
-- 2. TRIGGER handle_customer_user_link (tabela customers)
--    Quando user_id é vinculado (NULL → valor), concede acesso pendente
-- ════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.handle_customer_user_link()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Só dispara quando user_id passa de NULL para um valor
  IF OLD.user_id IS NOT NULL OR NEW.user_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Garantir role customer
  INSERT INTO user_roles (user_id, role)
  VALUES (NEW.user_id, 'customer')
  ON CONFLICT DO NOTHING;

  -- Conceder acesso a cursos de todas as orders ativas deste customer
  INSERT INTO course_customers (course_id, user_id)
  SELECT DISTINCT pc.course_id, NEW.user_id
  FROM orders o
  JOIN product_courses pc ON pc.product_id = o.product_id
  WHERE o.customer_id = NEW.id
    AND o.status IN ('approved', 'completed')
  ON CONFLICT (course_id, user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_handle_customer_user_link ON public.customers;
CREATE TRIGGER trg_handle_customer_user_link
  AFTER UPDATE OF user_id ON public.customers
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_customer_user_link();

-- ════════════════════════════════════════════════════════════
-- 3. RPC resolve_portal_customer
--    Chamada pelo frontend após auth no portal.
--    Vincula customer órfão (sem user_id) ao auth.user logado por email match.
-- ════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.resolve_portal_customer(p_tenant_slug text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_tenant_id uuid;
  v_user_email text;
  v_customer_id uuid;
BEGIN
  -- Buscar tenant
  SELECT id INTO v_tenant_id FROM tenants WHERE slug = p_tenant_slug;
  IF v_tenant_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Buscar email do auth.user logado
  SELECT email INTO v_user_email FROM auth.users WHERE id = auth.uid();
  IF v_user_email IS NULL THEN
    RETURN NULL;
  END IF;

  -- Tentar vincular customer órfão
  UPDATE customers
  SET user_id = auth.uid()
  WHERE tenant_id = v_tenant_id
    AND lower(email) = lower(v_user_email)
    AND user_id IS NULL
  RETURNING id INTO v_customer_id;

  RETURN v_customer_id;
END;
$$;

-- ════════════════════════════════════════════════════════════
-- 4. ATUALIZAR get_customer_purchased_products()
--    Aceitar status 'approved' além de 'completed'
-- ════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.get_customer_purchased_products()
RETURNS TABLE (
  product_id   uuid,
  product_name text,
  product_cover_url text,
  product_benefit text,
  order_id     uuid,
  order_status text,
  order_created_at timestamptz,
  unit_amount  integer,
  currency     text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT ON (o.product_id)
    o.product_id,
    p.name::text,
    p.cover_url::text,
    p.benefit::text,
    o.id        AS order_id,
    o.status::text,
    o.created_at,
    o.unit_amount,
    o.currency::text
  FROM public.orders o
  JOIN public.products p ON p.id = o.product_id
  JOIN public.customers c ON c.id = o.customer_id
  WHERE c.user_id = auth.uid()
    AND o.status IN ('approved', 'completed')
  ORDER BY o.product_id, o.created_at DESC;
END;
$$;

-- ════════════════════════════════════════════════════════════
-- 5. ATUALIZAR handle_new_user()
--    Customer signup: reconciliar customer existente por email
--    antes de criar novo (evita duplicatas do webhook Hotmart)
-- ════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  v_signup_as text;
  v_customer_tenant_id uuid;
  v_team_member_tenant_id uuid;
  v_reconciled boolean := false;
BEGIN
  -- Sempre cria profile
  INSERT INTO public.profiles (user_id, name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'name', NEW.email));

  v_signup_as := COALESCE(NEW.raw_user_meta_data->>'signup_as', 'tenant');

  IF v_signup_as = 'customer' THEN
    -- ── Customer signup ──
    v_customer_tenant_id := (NEW.raw_user_meta_data->>'customer_tenant_id')::uuid;

    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'customer')
    ON CONFLICT DO NOTHING;

    IF v_customer_tenant_id IS NOT NULL THEN
      -- Tentar vincular customer existente (criado por webhook) pelo email
      UPDATE public.customers
      SET user_id = NEW.id
      WHERE tenant_id = v_customer_tenant_id
        AND lower(email) = lower(NEW.email)
        AND user_id IS NULL;

      IF NOT FOUND THEN
        -- Nenhum customer órfão encontrado, criar novo
        INSERT INTO public.customers (tenant_id, user_id, name, email)
        VALUES (
          v_customer_tenant_id,
          NEW.id,
          COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
          NEW.email
        )
        ON CONFLICT (tenant_id, user_id) DO NOTHING;
      END IF;
    END IF;

  ELSIF v_signup_as = 'team_member' THEN
    -- ── Team member invite: recebe role tenant + vínculo com tenant ──
    v_team_member_tenant_id := (NEW.raw_user_meta_data->>'team_member_tenant_id')::uuid;

    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'tenant')
    ON CONFLICT DO NOTHING;

    -- Vincula ao tenant do convite como editor ativo
    IF v_team_member_tenant_id IS NOT NULL THEN
      INSERT INTO public.tenant_users (tenant_id, user_id, role, status)
      VALUES (v_team_member_tenant_id, NEW.id, 'editor', 'active')
      ON CONFLICT (tenant_id, user_id) DO UPDATE SET status = 'active';
    END IF;

  ELSE
    -- ── Tenant signup: apenas role, sem criar tenant/onboarding ──
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'tenant')
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$function$;

-- ════════════════════════════════════════════════════════════
-- 6. TABELA portal_auth_requests (rate limiting do portal login)
-- ════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.portal_auth_requests (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL,
  email text NOT NULL,
  ip_address text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_portal_auth_ip
  ON public.portal_auth_requests (ip_address, created_at);

CREATE INDEX IF NOT EXISTS idx_portal_auth_email
  ON public.portal_auth_requests (tenant_id, email, created_at);

-- Sem RLS — acessada apenas via SECURITY DEFINER functions e service_role
ALTER TABLE public.portal_auth_requests ENABLE ROW LEVEL SECURITY;
