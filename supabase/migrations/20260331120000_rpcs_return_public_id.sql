-- ============================================================
-- RPCs atualizadas para retornar public_id
-- Necessário para que o frontend use public_id nas URLs
-- ============================================================

-- 1. get_tenant_customers — adiciona c.public_id
DROP FUNCTION IF EXISTS public.get_tenant_customers(uuid, text);

CREATE OR REPLACE FUNCTION public.get_tenant_customers(
  p_tenant_id uuid,
  p_search text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  public_id text,
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
  IF NOT public.is_tenant_editor(p_tenant_id) AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN QUERY
  SELECT
    c.id,
    c.public_id,
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


-- 2. get_tenant_orders — adiciona o.public_id
DROP FUNCTION IF EXISTS public.get_tenant_orders(UUID, TEXT, INTEGER, INTEGER);

CREATE OR REPLACE FUNCTION public.get_tenant_orders(
  p_tenant_id UUID,
  p_search TEXT DEFAULT NULL,
  p_page INTEGER DEFAULT 0,
  p_page_size INTEGER DEFAULT 50
)
RETURNS TABLE (
  id UUID,
  public_id text,
  tenant_id UUID,
  customer_id UUID,
  product_id UUID,
  checkout_id UUID,
  price_id UUID,
  order_number INTEGER,
  type order_type,
  status order_status,
  unit_amount INTEGER,
  currency TEXT,
  is_order_bump BOOLEAN,
  parent_gateway_external_id TEXT,
  gateway_external_id TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  customer_name TEXT,
  customer_email TEXT,
  product_name TEXT,
  product_benefit TEXT,
  total_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_page_size INTEGER := LEAST(GREATEST(p_page_size, 1), 100);
  v_offset INTEGER := GREATEST(p_page, 0) * v_page_size;
  v_search TEXT := NULLIF(TRIM(p_search), '');
  v_search_int INTEGER;
BEGIN
  IF NOT public.is_tenant_editor(p_tenant_id) AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF v_search IS NOT NULL THEN
    BEGIN
      v_search_int := v_search::INTEGER;
    EXCEPTION WHEN OTHERS THEN
      v_search_int := NULL;
    END;
  END IF;

  RETURN QUERY
  SELECT
    o.id,
    o.public_id,
    o.tenant_id,
    o.customer_id,
    o.product_id,
    o.checkout_id,
    o.price_id,
    o.order_number,
    o.type,
    o.status,
    o.unit_amount,
    o.currency,
    COALESCE(o.is_order_bump, false),
    o.parent_gateway_external_id,
    o.gateway_external_id,
    o.created_at,
    o.updated_at,
    COALESCE(c.name, c.email, '') AS customer_name,
    COALESCE(c.email, '') AS customer_email,
    COALESCE(p.name, '') AS product_name,
    p.benefit AS product_benefit,
    COUNT(*) OVER() AS total_count
  FROM orders o
  LEFT JOIN customers c ON c.id = o.customer_id
  LEFT JOIN products p ON p.id = o.product_id
  WHERE o.tenant_id = p_tenant_id
    AND (
      v_search IS NULL
      OR (v_search_int IS NOT NULL AND o.order_number = v_search_int)
      OR COALESCE(c.name, '') ILIKE '%' || v_search || '%'
      OR c.email ILIKE '%' || v_search || '%'
      OR COALESCE(p.name, '') ILIKE '%' || v_search || '%'
    )
  ORDER BY o.created_at DESC, o.id DESC
  LIMIT v_page_size
  OFFSET v_offset;
END;
$$;


-- 3. get_customer_purchased_products — adiciona public_ids
DROP FUNCTION IF EXISTS public.get_customer_purchased_products();

CREATE OR REPLACE FUNCTION public.get_customer_purchased_products()
RETURNS TABLE (
  product_id uuid,
  product_public_id text,
  product_name text,
  product_cover_url text,
  product_updated_at timestamptz,
  product_benefit text,
  order_id uuid,
  order_status text,
  order_created_at timestamptz,
  unit_amount integer,
  currency text
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
    p.public_id AS product_public_id,
    p.name::text,
    p.cover_url::text,
    p.updated_at,
    p.benefit::text,
    o.id AS order_id,
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


-- 4. global_search — URLs com public_id
DROP FUNCTION IF EXISTS public.global_search(uuid, text);

CREATE FUNCTION public.global_search(
  p_tenant_id uuid,
  p_query text
)
RETURNS TABLE (
  category text,
  id uuid,
  public_id text,
  title text,
  subtitle text,
  url text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_query text;
BEGIN
  IF NOT public.is_tenant_editor(p_tenant_id) AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  v_query := trim(p_query);
  IF v_query = '' THEN
    RETURN;
  END IF;

  RETURN QUERY

  -- Courses
  (SELECT
    'course'::text AS category,
    c.id,
    c.public_id,
    c.title,
    CASE WHEN c.is_active THEN 'active' ELSE 'inactive' END AS subtitle,
    '/admin/courses/' || c.public_id AS url
  FROM public.courses c
  WHERE c.tenant_id = p_tenant_id
    AND (c.title ILIKE '%' || v_query || '%' OR c.public_id ILIKE '%' || v_query || '%')
  ORDER BY similarity(c.title, v_query) DESC
  LIMIT 5)

  UNION ALL

  -- Products
  (SELECT
    'product'::text AS category,
    pr.id,
    pr.public_id,
    pr.name AS title,
    pr.status::text AS subtitle,
    '/admin/products/' || pr.public_id AS url
  FROM public.products pr
  WHERE pr.tenant_id = p_tenant_id
    AND (pr.name ILIKE '%' || v_query || '%' OR pr.public_id ILIKE '%' || v_query || '%')
  ORDER BY similarity(pr.name, v_query) DESC
  LIMIT 5)

  UNION ALL

  -- Assets
  (SELECT
    'asset'::text AS category,
    a.id,
    a.public_id,
    a.title,
    a.type::text AS subtitle,
    '/admin/assets/' || a.public_id AS url
  FROM public.assets a
  WHERE a.tenant_id = p_tenant_id
    AND a.status <> 'deleted'
    AND (a.title ILIKE '%' || v_query || '%' OR a.public_id ILIKE '%' || v_query || '%')
  ORDER BY similarity(a.title, v_query) DESC
  LIMIT 5)

  UNION ALL

  -- Customers
  (SELECT
    'customer'::text AS category,
    cu.id,
    cu.public_id,
    COALESCE(cu.name, split_part(cu.email, '@', 1)) AS title,
    cu.email AS subtitle,
    '/admin/customers/' || cu.public_id AS url
  FROM public.customers cu
  WHERE cu.tenant_id = p_tenant_id
    AND (
      COALESCE(cu.name, '') ILIKE '%' || v_query || '%'
      OR cu.email ILIKE '%' || v_query || '%'
      OR cu.public_id ILIKE '%' || v_query || '%'
    )
  ORDER BY similarity(COALESCE(cu.name, cu.email), v_query) DESC
  LIMIT 5);
END;
$$;


-- 5. duplicate_course — retorna public_id no JSON
DROP FUNCTION IF EXISTS public.duplicate_course(uuid, uuid);

CREATE OR REPLACE FUNCTION public.duplicate_course(
  p_source_course_id uuid,
  p_tenant_id uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_source        RECORD;
  v_new_course_id uuid;
  v_new_public_id text;
  v_base_slug     text;
  v_slug          text;
  v_counter       int := 1;
  v_slug_exists   boolean;
  v_mod           RECORD;
  v_new_module_id uuid;
  v_les           RECORD;
  v_new_lesson_id uuid;
  v_media_lessons json := '[]'::json;
BEGIN
  SELECT id, title, slug, description, category, is_active,
         cover_horizontal_url, cover_vertical_url
    INTO v_source
    FROM courses
   WHERE id = p_source_course_id
     AND tenant_id = p_tenant_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Course not found or does not belong to this tenant';
  END IF;

  v_base_slug := v_source.slug || '-copia';
  v_slug := v_base_slug;

  LOOP
    SELECT EXISTS(
      SELECT 1 FROM courses WHERE tenant_id = p_tenant_id AND slug = v_slug
    ) INTO v_slug_exists;

    EXIT WHEN NOT v_slug_exists;

    v_counter := v_counter + 1;
    v_slug := v_base_slug || '-' || v_counter;
  END LOOP;

  INSERT INTO courses (tenant_id, title, slug, description, category, is_active,
                       cover_horizontal_url, cover_vertical_url)
  VALUES (p_tenant_id,
          v_source.title || ' (Cópia)',
          v_slug,
          v_source.description,
          v_source.category,
          v_source.is_active,
          v_source.cover_horizontal_url,
          v_source.cover_vertical_url)
  RETURNING id, public_id INTO v_new_course_id, v_new_public_id;

  DELETE FROM modules WHERE course_id = v_new_course_id;

  FOR v_mod IN
    SELECT id, title, description, sort_order, is_default
      FROM modules
     WHERE course_id = p_source_course_id
     ORDER BY sort_order
  LOOP
    INSERT INTO modules (course_id, title, description, sort_order, is_default)
    VALUES (v_new_course_id, v_mod.title, v_mod.description, v_mod.sort_order, v_mod.is_default)
    RETURNING id INTO v_new_module_id;

    FOR v_les IN
      SELECT id, title, description, content, thumbnail_url, video_url,
             video_provider, duration_seconds, sort_order, is_active
        FROM lessons
       WHERE module_id = v_mod.id
       ORDER BY sort_order
    LOOP
      INSERT INTO lessons (module_id, title, description, content, thumbnail_url,
                           video_url, video_provider, duration_seconds, sort_order, is_active)
      VALUES (v_new_module_id, v_les.title, v_les.description, v_les.content,
              v_les.thumbnail_url, v_les.video_url, v_les.video_provider,
              v_les.duration_seconds, v_les.sort_order, v_les.is_active)
      RETURNING id INTO v_new_lesson_id;

      INSERT INTO lesson_videos (lesson_id, provider, gumlet_asset_id, gumlet_collection_id,
                                 playback_url, thumbnail_url, status, duration_seconds,
                                 is_public, provider_payload)
      SELECT v_new_lesson_id, provider, gumlet_asset_id, gumlet_collection_id,
             playback_url, thumbnail_url, status, duration_seconds,
             is_public, provider_payload
        FROM lesson_videos
       WHERE lesson_id = v_les.id;

      INSERT INTO lesson_assets_link (lesson_id, asset_id, sort_order, label)
      SELECT v_new_lesson_id, asset_id, sort_order, label
        FROM lesson_assets_link
       WHERE lesson_id = v_les.id;

      IF v_les.thumbnail_url IS NOT NULL THEN
        v_media_lessons := (
          SELECT json_agg(elem)
            FROM (
              SELECT elem FROM json_array_elements(v_media_lessons) AS elem
              UNION ALL
              SELECT json_build_object(
                'old_lesson_id', v_les.id,
                'new_lesson_id', v_new_lesson_id,
                'thumbnail_url', v_les.thumbnail_url
              )
            ) sub
        );
      END IF;
    END LOOP;
  END LOOP;

  RETURN json_build_object(
    'course_id', v_new_course_id,
    'public_id', v_new_public_id,
    'slug', v_slug,
    'title', v_source.title || ' (Cópia)',
    'media_map', json_build_object(
      'course_cover_horizontal', v_source.cover_horizontal_url,
      'course_cover_vertical', v_source.cover_vertical_url,
      'lessons', COALESCE(v_media_lessons, '[]'::json)
    )
  );
END;
$$;
