-- Normalize stored cover values and simplify showcase/course cover handling.

-- 1. Normalize product cover values
UPDATE public.products
SET cover_url = CASE
  WHEN cover_url LIKE '%/storage/v1/object/public/covers/%'
    THEN split_part(
      split_part(cover_url, '/storage/v1/object/public/covers/', 2),
      '?',
      1
    )
  ELSE regexp_replace(cover_url, '\?t=[^#]*$', '')
END
WHERE cover_url IS NOT NULL;

-- 2. Normalize course cover values
UPDATE public.courses
SET cover_horizontal_url = CASE
  WHEN cover_horizontal_url LIKE '%/storage/v1/object/public/covers/%'
    THEN split_part(
      split_part(cover_horizontal_url, '/storage/v1/object/public/covers/', 2),
      '?',
      1
    )
  ELSE regexp_replace(cover_horizontal_url, '\?t=[^#]*$', '')
END
WHERE cover_horizontal_url IS NOT NULL;

-- 3. Showcases are horizontal-only in the application
UPDATE public.showcases
SET cover_format = 'horizontal'
WHERE cover_format IS DISTINCT FROM 'horizontal';

ALTER TABLE public.showcases
ALTER COLUMN cover_format SET DEFAULT 'horizontal';

-- 4. Duplicate course without depending on legacy vertical cover handling
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
  v_new_smart_id  text;
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
  SELECT id, title, slug, description, category, is_active, cover_horizontal_url
    INTO v_source
    FROM public.courses
   WHERE id = p_source_course_id
     AND tenant_id = p_tenant_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Course not found or does not belong to this tenant';
  END IF;

  v_base_slug := v_source.slug || '-copia';
  v_slug := v_base_slug;

  LOOP
    SELECT EXISTS(
      SELECT 1 FROM public.courses WHERE tenant_id = p_tenant_id AND slug = v_slug
    ) INTO v_slug_exists;

    EXIT WHEN NOT v_slug_exists;

    v_counter := v_counter + 1;
    v_slug := v_base_slug || '-' || v_counter;
  END LOOP;

  INSERT INTO public.courses (
    tenant_id,
    title,
    slug,
    description,
    category,
    is_active,
    cover_horizontal_url
  )
  VALUES (
    p_tenant_id,
    v_source.title || ' (Cópia)',
    v_slug,
    v_source.description,
    v_source.category,
    v_source.is_active,
    v_source.cover_horizontal_url
  )
  RETURNING id, smart_id INTO v_new_course_id, v_new_smart_id;

  DELETE FROM public.modules WHERE course_id = v_new_course_id;

  FOR v_mod IN
    SELECT id, title, description, sort_order, is_default
      FROM public.modules
     WHERE course_id = p_source_course_id
     ORDER BY sort_order
  LOOP
    INSERT INTO public.modules (course_id, title, description, sort_order, is_default)
    VALUES (v_new_course_id, v_mod.title, v_mod.description, v_mod.sort_order, v_mod.is_default)
    RETURNING id INTO v_new_module_id;

    FOR v_les IN
      SELECT id, title, description, content, thumbnail_url, video_url,
             video_provider, duration_seconds, sort_order, is_active
        FROM public.lessons
       WHERE module_id = v_mod.id
       ORDER BY sort_order
    LOOP
      INSERT INTO public.lessons (
        module_id,
        title,
        description,
        content,
        thumbnail_url,
        video_url,
        video_provider,
        duration_seconds,
        sort_order,
        is_active
      )
      VALUES (
        v_new_module_id,
        v_les.title,
        v_les.description,
        v_les.content,
        v_les.thumbnail_url,
        v_les.video_url,
        v_les.video_provider,
        v_les.duration_seconds,
        v_les.sort_order,
        v_les.is_active
      )
      RETURNING id INTO v_new_lesson_id;

      INSERT INTO public.lesson_videos (
        lesson_id,
        provider,
        gumlet_asset_id,
        gumlet_collection_id,
        playback_url,
        thumbnail_url,
        status,
        duration_seconds,
        is_public,
        provider_payload
      )
      SELECT
        v_new_lesson_id,
        provider,
        gumlet_asset_id,
        gumlet_collection_id,
        playback_url,
        thumbnail_url,
        status,
        duration_seconds,
        is_public,
        provider_payload
      FROM public.lesson_videos
      WHERE lesson_id = v_les.id;

      INSERT INTO public.lesson_assets_link (lesson_id, asset_id, sort_order, label)
      SELECT v_new_lesson_id, asset_id, sort_order, label
      FROM public.lesson_assets_link
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
    'smart_id', v_new_smart_id,
    'slug', v_slug,
    'title', v_source.title || ' (Cópia)',
    'media_map', json_build_object(
      'course_cover_horizontal', v_source.cover_horizontal_url,
      'lessons', COALESCE(v_media_lessons, '[]'::json)
    )
  );
END;
$$;

-- 5. Portal purchased products should expose product updated_at for cache versioning
DROP FUNCTION IF EXISTS public.get_customer_purchased_products();

CREATE OR REPLACE FUNCTION public.get_customer_purchased_products()
RETURNS TABLE (
  product_id uuid,
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

-- 6. Public checkout should expose product updated_at for cache versioning
DROP FUNCTION IF EXISTS public.get_public_checkout(text);

CREATE OR REPLACE FUNCTION public.get_public_checkout(
  p_checkout_smart_id text
)
RETURNS TABLE (
  id uuid,
  smart_id text,
  title text,
  description text,
  collect_phone boolean,
  collect_address boolean,
  collect_fiscal_id boolean,
  allow_discount_codes boolean,
  expires_at timestamptz,
  cover_url text,
  confirmation_message text,
  success_url text,
  product_name text,
  product_cover_url text,
  product_updated_at timestamptz,
  product_status text,
  unit_amount integer,
  currency text,
  price_category text,
  renewal_interval_unit text,
  renewal_interval_quantity integer,
  tenant_name text,
  tenant_slug text,
  tenant_icon_url text,
  tenant_primary_color text,
  tenant_theme_mode text,
  checkout_use_brand_colors boolean,
  checkout_bg_color text,
  checkout_button_color text,
  checkout_button_style text,
  checkout_font_family text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    c.smart_id,
    c.title,
    c.description,
    c.collect_phone,
    c.collect_address,
    c.collect_fiscal_id,
    c.allow_discount_codes,
    c.expires_at,
    c.cover_url,
    c.confirmation_message,
    c.success_url,
    p.name AS product_name,
    p.cover_url AS product_cover_url,
    p.updated_at AS product_updated_at,
    p.status::text AS product_status,
    pr.unit_amount,
    pr.currency,
    pr.category::text AS price_category,
    pr.renewal_interval_unit::text AS renewal_interval_unit,
    pr.renewal_interval_quantity,
    t.name AS tenant_name,
    t.slug AS tenant_slug,
    ts.icon_url AS tenant_icon_url,
    ts.primary_color AS tenant_primary_color,
    ts.theme_mode::text AS tenant_theme_mode,
    ts.checkout_use_brand_colors,
    ts.checkout_bg_color,
    ts.checkout_button_color,
    ts.checkout_button_style,
    ts.checkout_font_family
  FROM public.checkouts c
  JOIN public.tenants t ON t.id = c.tenant_id
  JOIN public.tenant_settings ts ON ts.tenant_id = t.id
  JOIN public.products p ON p.id = c.product_id
  JOIN public.prices pr ON pr.id = c.price_id
  WHERE c.smart_id = p_checkout_smart_id
    AND c.status = 'active'
    AND pr.is_active = true
    AND (c.expires_at IS NULL OR c.expires_at > now());
END;
$$;
