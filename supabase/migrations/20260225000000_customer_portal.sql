-- ══════════════════════════════════════════════════════════════
-- Customer Portal: RPCs for self-service
-- ══════════════════════════════════════════════════════════════

-- 1. RPC: Customer can update their own profile (limited fields)
CREATE OR REPLACE FUNCTION public.update_customer_profile(
  p_name text DEFAULT NULL,
  p_phone text DEFAULT NULL,
  p_city text DEFAULT NULL,
  p_region text DEFAULT NULL,
  p_country text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  UPDATE public.customers
  SET
    name    = COALESCE(p_name, name),
    phone   = COALESCE(p_phone, phone),
    city    = COALESCE(p_city, city),
    region  = COALESCE(p_region, region),
    country = COALESCE(p_country, country),
    updated_at = now()
  WHERE user_id = auth.uid();

  -- Keep profiles.name in sync
  IF p_name IS NOT NULL THEN
    UPDATE public.profiles
    SET name = p_name, updated_at = now()
    WHERE user_id = auth.uid();
  END IF;
END;
$$;

-- 2. RPC: List products purchased by the authenticated customer
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
    AND o.status = 'completed'
  ORDER BY o.product_id, o.created_at DESC;
END;
$$;
