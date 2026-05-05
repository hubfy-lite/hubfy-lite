-- ============================================================
-- Customer RPCs: include identity fields used by Admin Customer Sheet
-- ============================================================

-- Replace get_tenant_customers so frontend receives first/last/document fields
DROP FUNCTION IF EXISTS public.get_tenant_customers(uuid, text);

CREATE OR REPLACE FUNCTION public.get_tenant_customers(
  p_tenant_id uuid,
  p_search text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  email text,
  name text,
  first_name text,
  last_name text,
  document_type text,
  document text,
  avatar_url text,
  phone text,
  city text,
  region text,
  country text,
  email_marketing_status text,
  total_revenue_cents integer,
  mrr_cents integer,
  currency text,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  IF NOT public.is_tenant_customer(p_tenant_id) AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN QUERY
  SELECT
    c.id,
    c.user_id,
    c.email,
    COALESCE(c.name, p.name, split_part(c.email, '@', 1)) AS name,
    c.first_name,
    c.last_name,
    c.document_type,
    c.document,
    p.avatar_url,
    c.phone,
    c.city,
    c.region,
    c.country,
    c.email_marketing_status::text,
    c.total_revenue_cents,
    c.mrr_cents,
    c.currency,
    c.created_at,
    c.updated_at
  FROM public.customers c
  LEFT JOIN public.profiles p ON p.user_id = c.user_id
  WHERE c.tenant_id = p_tenant_id
    AND (
      p_search IS NULL
      OR p_search = ''
      OR COALESCE(c.name, '') ILIKE '%' || p_search || '%'
      OR c.email ILIKE '%' || p_search || '%'
      OR COALESCE(c.phone, '') ILIKE '%' || p_search || '%'
    )
  ORDER BY c.created_at DESC;
END;
$$;

-- Replace update_tenant_customer so frontend can persist identity fields
DROP FUNCTION IF EXISTS public.update_tenant_customer(uuid, uuid, text, text, text, text, text, text);

CREATE OR REPLACE FUNCTION public.update_tenant_customer(
  p_tenant_id uuid,
  p_user_id uuid,
  p_name text DEFAULT NULL,
  p_first_name text DEFAULT NULL,
  p_last_name text DEFAULT NULL,
  p_phone text DEFAULT NULL,
  p_city text DEFAULT NULL,
  p_region text DEFAULT NULL,
  p_country text DEFAULT NULL,
  p_document_type text DEFAULT NULL,
  p_document text DEFAULT NULL,
  p_email_marketing_status text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_document_type text;
  v_document text;
  v_existing_document_type text;
BEGIN
  IF NOT public.is_tenant_editor(p_tenant_id) AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  v_document_type := CASE
    WHEN p_document_type IS NULL THEN NULL
    ELSE NULLIF(upper(trim(p_document_type)), '')
  END;
  v_document := CASE
    WHEN p_document IS NULL THEN NULL
    ELSE NULLIF(trim(p_document), '')
  END;

  IF v_document_type IS NOT NULL AND v_document_type NOT IN ('CPF', 'CNPJ') THEN
    RAISE EXCEPTION 'document_type must be CPF or CNPJ';
  END IF;

  IF v_document IS NOT NULL AND v_document_type IS NULL THEN
    SELECT NULLIF(upper(trim(document_type)), '')
      INTO v_existing_document_type
    FROM public.customers
    WHERE tenant_id = p_tenant_id
      AND user_id = p_user_id
    LIMIT 1;

    IF v_existing_document_type IS NULL OR v_existing_document_type NOT IN ('CPF', 'CNPJ') THEN
      RAISE EXCEPTION 'document_type must be CPF or CNPJ when document is provided';
    END IF;
  END IF;

  UPDATE public.customers
  SET
    name = COALESCE(p_name, name),
    first_name = COALESCE(p_first_name, first_name),
    last_name = COALESCE(p_last_name, last_name),
    phone = COALESCE(p_phone, phone),
    city = COALESCE(p_city, city),
    region = COALESCE(p_region, region),
    country = COALESCE(p_country, country),
    document_type = COALESCE(v_document_type, document_type),
    document = COALESCE(v_document, document),
    email_marketing_status = COALESCE(
      p_email_marketing_status::email_marketing_status,
      email_marketing_status
    ),
    updated_at = now()
  WHERE tenant_id = p_tenant_id
    AND user_id = p_user_id;

  IF p_name IS NOT NULL THEN
    UPDATE public.profiles
    SET name = p_name, updated_at = now()
    WHERE user_id = p_user_id;
  END IF;
END;
$$;
