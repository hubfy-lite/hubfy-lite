-- Merge user data from source user into target user and remove source user.
-- source: 9a97a5e9-c42b-4d82-982e-cbc7eb153a74
-- target: b488c6ea-6a0a-47fb-acd1-a82d483608e9

BEGIN;

DO $$
DECLARE
  v_source CONSTANT uuid := '9a97a5e9-c42b-4d82-982e-cbc7eb153a74';
  v_target CONSTANT uuid := 'b488c6ea-6a0a-47fb-acd1-a82d483608e9';

  v_source_email text;
  v_source_phone text;
  v_source_raw_user_meta_data jsonb;
  v_source_raw_app_meta_data jsonb;
  v_source_email_confirmed_at timestamptz;
  v_source_phone_confirmed_at timestamptz;
  v_source_last_sign_in_at timestamptz;
  v_source_is_sso_user boolean;
  v_source_is_anonymous boolean;

  v_tenant_user_source public.tenant_users%ROWTYPE;
  v_customer_source public.customers%ROWTYPE;

  r record;
  uq record;
  v_other_cols text[];
  v_cond text;
BEGIN
  IF v_source = v_target THEN
    RAISE EXCEPTION 'source and target users must be different';
  END IF;

  PERFORM 1 FROM auth.users WHERE id = v_source FOR UPDATE;
  IF NOT FOUND THEN
    RAISE NOTICE 'source user % not found, skipping merge migration', v_source;
    RETURN;
  END IF;

  PERFORM 1 FROM auth.users WHERE id = v_target FOR UPDATE;
  IF NOT FOUND THEN
    RAISE NOTICE 'target user % not found, skipping merge migration', v_target;
    RETURN;
  END IF;

  SELECT
    email,
    phone,
    COALESCE(raw_user_meta_data, '{}'::jsonb),
    COALESCE(raw_app_meta_data, '{}'::jsonb),
    email_confirmed_at,
    phone_confirmed_at,
    last_sign_in_at,
    is_sso_user,
    is_anonymous
  INTO
    v_source_email,
    v_source_phone,
    v_source_raw_user_meta_data,
    v_source_raw_app_meta_data,
    v_source_email_confirmed_at,
    v_source_phone_confirmed_at,
    v_source_last_sign_in_at,
    v_source_is_sso_user,
    v_source_is_anonymous
  FROM auth.users
  WHERE id = v_source;

  -- Ensure target has profile before merging profile attributes.
  INSERT INTO public.profiles (user_id, name)
  VALUES (
    v_target,
    COALESCE(v_source_raw_user_meta_data->>'name', v_source_email, 'Usuario')
  )
  ON CONFLICT (user_id) DO NOTHING;

  -- user_roles: union of roles from both users.
  INSERT INTO public.user_roles (user_id, role, created_at)
  SELECT v_target, ur.role, MIN(ur.created_at)
  FROM public.user_roles ur
  WHERE ur.user_id IN (v_source, v_target)
  GROUP BY ur.role
  ON CONFLICT (user_id, role) DO NOTHING;

  DELETE FROM public.user_roles
  WHERE user_id = v_source;

  -- tenant_users: merge duplicated memberships preserving strongest role.
  FOR r IN
    SELECT s.id AS source_id, t.id AS target_id
    FROM public.tenant_users s
    JOIN public.tenant_users t
      ON t.tenant_id = s.tenant_id
     AND t.user_id = v_target
    WHERE s.user_id = v_source
  LOOP
    SELECT * INTO v_tenant_user_source
    FROM public.tenant_users
    WHERE id = r.source_id
    FOR UPDATE;

    UPDATE public.tenant_users t
    SET
      role = CASE
        WHEN t.role = 'owner' OR v_tenant_user_source.role = 'owner' THEN 'owner'
        ELSE 'editor'
      END,
      status = CASE
        WHEN COALESCE(t.status, 'active') = 'active'
          OR COALESCE(v_tenant_user_source.status, 'active') = 'active'
          THEN 'active'
        ELSE COALESCE(v_tenant_user_source.status, t.status)
      END,
      phone = COALESCE(v_tenant_user_source.phone, t.phone),
      country = COALESCE(v_tenant_user_source.country, t.country),
      created_at = LEAST(t.created_at, v_tenant_user_source.created_at)
    WHERE t.id = r.target_id;

    DELETE FROM public.tenant_users
    WHERE id = r.source_id;
  END LOOP;

  UPDATE public.tenant_users
  SET user_id = v_target
  WHERE user_id = v_source;

  -- course_customers: keep earliest access row per course.
  INSERT INTO public.course_customers (course_id, user_id, created_at)
  SELECT cc.course_id, v_target, MIN(cc.created_at)
  FROM public.course_customers cc
  WHERE cc.user_id IN (v_source, v_target)
  GROUP BY cc.course_id
  ON CONFLICT (course_id, user_id) DO UPDATE
  SET created_at = LEAST(public.course_customers.created_at, EXCLUDED.created_at);

  DELETE FROM public.course_customers
  WHERE user_id = v_source;

  -- showcase_customers: keep earliest membership per showcase.
  INSERT INTO public.showcase_customers (showcase_id, user_id, created_at)
  SELECT sc.showcase_id, v_target, MIN(sc.created_at)
  FROM public.showcase_customers sc
  WHERE sc.user_id IN (v_source, v_target)
  GROUP BY sc.showcase_id
  ON CONFLICT (showcase_id, user_id) DO UPDATE
  SET created_at = LEAST(public.showcase_customers.created_at, EXCLUDED.created_at);

  DELETE FROM public.showcase_customers
  WHERE user_id = v_source;

  -- lesson_progress: keep the most advanced progress per lesson.
  INSERT INTO public.lesson_progress (user_id, lesson_id, completed, progress_seconds, completed_at, updated_at)
  SELECT
    v_target AS user_id,
    lp.lesson_id,
    BOOL_OR(lp.completed) AS completed,
    MAX(lp.progress_seconds) AS progress_seconds,
    MAX(lp.completed_at) AS completed_at,
    MAX(lp.updated_at) AS updated_at
  FROM public.lesson_progress lp
  WHERE lp.user_id IN (v_source, v_target)
  GROUP BY lp.lesson_id
  ON CONFLICT (user_id, lesson_id) DO UPDATE
  SET
    completed = public.lesson_progress.completed OR EXCLUDED.completed,
    progress_seconds = GREATEST(public.lesson_progress.progress_seconds, EXCLUDED.progress_seconds),
    completed_at = CASE
      WHEN public.lesson_progress.completed_at IS NULL THEN EXCLUDED.completed_at
      WHEN EXCLUDED.completed_at IS NULL THEN public.lesson_progress.completed_at
      ELSE GREATEST(public.lesson_progress.completed_at, EXCLUDED.completed_at)
    END,
    updated_at = GREATEST(public.lesson_progress.updated_at, EXCLUDED.updated_at);

  DELETE FROM public.lesson_progress
  WHERE user_id = v_source;

  -- customers: merge duplicate customer rows by tenant and sum metrics.
  FOR r IN
    SELECT s.id AS source_id, t.id AS target_id
    FROM public.customers s
    JOIN public.customers t
      ON t.tenant_id = s.tenant_id
     AND t.user_id = v_target
    WHERE s.user_id = v_source
  LOOP
    SELECT * INTO v_customer_source
    FROM public.customers
    WHERE id = r.source_id
    FOR UPDATE;

    UPDATE public.orders
    SET customer_id = r.target_id
    WHERE customer_id = r.source_id;

    UPDATE public.delivery_emails
    SET customer_id = r.target_id
    WHERE customer_id = r.source_id;

    DELETE FROM public.customers
    WHERE id = r.source_id;

    UPDATE public.customers t
    SET
      name = COALESCE(v_customer_source.name, t.name),
      first_name = COALESCE(v_customer_source.first_name, t.first_name),
      last_name = COALESCE(v_customer_source.last_name, t.last_name),
      email = COALESCE(v_customer_source.email, t.email),
      phone = COALESCE(v_customer_source.phone, t.phone),
      city = COALESCE(v_customer_source.city, t.city),
      region = COALESCE(v_customer_source.region, t.region),
      country = COALESCE(v_customer_source.country, t.country),
      document = COALESCE(v_customer_source.document, t.document),
      document_type = COALESCE(v_customer_source.document_type, t.document_type),
      email_marketing_status = COALESCE(v_customer_source.email_marketing_status, t.email_marketing_status),
      total_revenue_cents = COALESCE(t.total_revenue_cents, 0) + COALESCE(v_customer_source.total_revenue_cents, 0),
      mrr_cents = COALESCE(t.mrr_cents, 0) + COALESCE(v_customer_source.mrr_cents, 0),
      currency = COALESCE(v_customer_source.currency, t.currency),
      created_at = LEAST(t.created_at, v_customer_source.created_at),
      updated_at = GREATEST(t.updated_at, v_customer_source.updated_at, now())
    WHERE t.id = r.target_id;
  END LOOP;

  UPDATE public.customers
  SET user_id = v_target
  WHERE user_id = v_source;

  -- Non-FK user references.
  UPDATE public.assets
  SET created_by = v_target
  WHERE created_by = v_source;

  UPDATE public.tenants
  SET created_by = v_target
  WHERE created_by = v_source;

  -- Remaining public FK columns that reference auth.users(id).
  FOR r IN
    SELECT
      ns.nspname AS table_schema,
      cls.relname AS table_name,
      att.attname AS column_name,
      att.attnum AS column_attnum
    FROM pg_constraint c
    JOIN pg_class cls ON cls.oid = c.conrelid
    JOIN pg_namespace ns ON ns.oid = cls.relnamespace
    JOIN pg_class refcls ON refcls.oid = c.confrelid
    JOIN pg_namespace refns ON refns.oid = refcls.relnamespace
    JOIN LATERAL unnest(c.conkey) WITH ORDINALITY AS fk(attnum, ord) ON TRUE
    JOIN LATERAL unnest(c.confkey) WITH ORDINALITY AS pk(attnum, ord) ON pk.ord = fk.ord
    JOIN pg_attribute att ON att.attrelid = cls.oid AND att.attnum = fk.attnum
    JOIN pg_attribute refatt ON refatt.attrelid = refcls.oid AND refatt.attnum = pk.attnum
    WHERE c.contype = 'f'
      AND ns.nspname = 'public'
      AND refns.nspname = 'auth'
      AND refcls.relname = 'users'
      AND refatt.attname = 'id'
      AND array_length(c.conkey, 1) = 1
  LOOP
    IF r.table_name = ANY (
      ARRAY[
        'profiles',
        'user_roles',
        'tenant_users',
        'customers',
        'course_customers',
        'showcase_customers',
        'lesson_progress'
      ]
    ) THEN
      CONTINUE;
    END IF;

    FOR uq IN
      SELECT
        idx.indexrelid,
        idx.indnullsnotdistinct,
        array_agg(att2.attname ORDER BY ord.pos) AS cols
      FROM pg_index idx
      JOIN pg_class tbl ON tbl.oid = idx.indrelid
      JOIN pg_namespace nst ON nst.oid = tbl.relnamespace
      JOIN LATERAL (
        SELECT gs AS pos, idx.indkey[gs] AS attnum
        FROM generate_subscripts(idx.indkey, 1) gs
        WHERE idx.indkey[gs] > 0
      ) ord ON TRUE
      JOIN pg_attribute att2 ON att2.attrelid = tbl.oid AND att2.attnum = ord.attnum
      WHERE nst.nspname = r.table_schema
        AND tbl.relname = r.table_name
        AND idx.indisunique
        AND idx.indpred IS NULL
        AND idx.indexprs IS NULL
        AND EXISTS (
          SELECT 1
          FROM generate_subscripts(idx.indkey, 1) gs2
          WHERE idx.indkey[gs2] = r.column_attnum
        )
      GROUP BY idx.indexrelid, idx.indnullsnotdistinct
    LOOP
      v_other_cols := array_remove(uq.cols, r.column_name);

      IF array_length(v_other_cols, 1) IS NULL THEN
        EXECUTE format(
          'DELETE FROM %I.%I s
            WHERE s.%I = $1
              AND EXISTS (
                SELECT 1
                FROM %I.%I t
                WHERE t.%I = $2
              )',
          r.table_schema,
          r.table_name,
          r.column_name,
          r.table_schema,
          r.table_name,
          r.column_name
        ) USING v_source, v_target;
      ELSE
        SELECT string_agg(
          CASE
            WHEN uq.indnullsnotdistinct THEN format('t.%1$I IS NOT DISTINCT FROM s.%1$I', c)
            ELSE format('t.%1$I = s.%1$I', c)
          END,
          ' AND '
        )
        INTO v_cond
        FROM unnest(v_other_cols) AS c;

        EXECUTE format(
          'DELETE FROM %I.%I s
            WHERE s.%I = $1
              AND EXISTS (
                SELECT 1
                FROM %I.%I t
                WHERE t.%I = $2
                  AND %s
              )',
          r.table_schema,
          r.table_name,
          r.column_name,
          r.table_schema,
          r.table_name,
          r.column_name,
          v_cond
        ) USING v_source, v_target;
      END IF;
    END LOOP;

    EXECUTE format(
      'UPDATE %I.%I
          SET %I = $1
        WHERE %I = $2',
      r.table_schema,
      r.table_name,
      r.column_name,
      r.column_name
    ) USING v_target, v_source;
  END LOOP;

  -- Merge profile attributes (source values win when present).
  IF EXISTS (SELECT 1 FROM public.profiles WHERE user_id = v_source) THEN
    UPDATE public.profiles t
    SET
      name = COALESCE(s.name, t.name),
      avatar_url = COALESCE(s.avatar_url, t.avatar_url),
      bio = COALESCE(s.bio, t.bio),
      preferences = COALESCE(t.preferences, '{}'::jsonb) || COALESCE(s.preferences, '{}'::jsonb),
      updated_at = GREATEST(t.updated_at, s.updated_at, now())
    FROM public.profiles s
    WHERE t.user_id = v_target
      AND s.user_id = v_source;
  ELSE
    UPDATE public.profiles t
    SET
      name = COALESCE(v_source_raw_user_meta_data->>'name', t.name),
      avatar_url = COALESCE(v_source_raw_user_meta_data->>'avatar_url', t.avatar_url),
      updated_at = now()
    WHERE t.user_id = v_target;
  END IF;

  -- Remove source auth user (cascades profile cleanup for source user_id).
  DELETE FROM auth.users
  WHERE id = v_source;

  -- Overwrite target auth identity fields with source values.
  UPDATE auth.users u
  SET
    email = COALESCE(v_source_email, u.email),
    phone = COALESCE(v_source_phone, u.phone),
    raw_user_meta_data = COALESCE(u.raw_user_meta_data, '{}'::jsonb) || COALESCE(v_source_raw_user_meta_data, '{}'::jsonb),
    raw_app_meta_data = COALESCE(u.raw_app_meta_data, '{}'::jsonb) || COALESCE(v_source_raw_app_meta_data, '{}'::jsonb),
    email_confirmed_at = COALESCE(v_source_email_confirmed_at, u.email_confirmed_at),
    phone_confirmed_at = COALESCE(v_source_phone_confirmed_at, u.phone_confirmed_at),
    is_sso_user = COALESCE(v_source_is_sso_user, u.is_sso_user),
    is_anonymous = COALESCE(v_source_is_anonymous, false) AND COALESCE(u.is_anonymous, false),
    last_sign_in_at = CASE
      WHEN u.last_sign_in_at IS NULL THEN v_source_last_sign_in_at
      WHEN v_source_last_sign_in_at IS NULL THEN u.last_sign_in_at
      ELSE GREATEST(u.last_sign_in_at, v_source_last_sign_in_at)
    END,
    updated_at = now()
  WHERE u.id = v_target;

  RAISE NOTICE 'Merged user % into % and removed source user', v_source, v_target;
END $$;

COMMIT;
