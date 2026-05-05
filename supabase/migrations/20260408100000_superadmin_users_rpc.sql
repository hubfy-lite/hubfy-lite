-- ============================================================
-- RPC get_superadmin_users
-- Lista TODOS os usuários com role='tenant', incluindo aqueles
-- que ainda não verificaram email ou criaram workspace.
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_superadmin_users(
  p_search TEXT DEFAULT NULL,
  p_page INTEGER DEFAULT 0,
  p_page_size INTEGER DEFAULT 50,
  p_sort_by TEXT DEFAULT 'created_at',
  p_sort_dir TEXT DEFAULT 'desc',
  p_email_status TEXT[] DEFAULT NULL,
  p_workspace_status TEXT[] DEFAULT NULL
)
RETURNS TABLE (
  user_id UUID,
  name TEXT,
  email TEXT,
  email_confirmed_at TIMESTAMPTZ,
  whatsapp TEXT,
  created_at TIMESTAMPTZ,
  tenant_name TEXT,
  tenant_slug TEXT,
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
  v_sort_by TEXT := COALESCE(NULLIF(TRIM(p_sort_by), ''), 'created_at');
  v_sort_dir TEXT := CASE WHEN LOWER(TRIM(p_sort_dir)) = 'asc' THEN 'asc' ELSE 'desc' END;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  RETURN QUERY
  WITH base AS (
    SELECT
      ur.user_id AS uid,
      COALESCE(pr.name, au.email)::TEXT AS uname,
      au.email::TEXT AS uemail,
      au.email_confirmed_at AS uemail_confirmed,
      pr.whatsapp::TEXT AS uwhatsapp,
      COALESCE(pr.created_at, au.created_at) AS ucreated,
      ws.tname::TEXT AS ws_name,
      ws.tslug::TEXT AS ws_slug
    FROM user_roles ur
    JOIN auth.users au ON au.id = ur.user_id
    LEFT JOIN profiles pr ON pr.user_id = ur.user_id
    LEFT JOIN LATERAL (
      SELECT t.name AS tname, t.slug AS tslug
      FROM tenant_users tu
      JOIN tenants t ON t.id = tu.tenant_id
      WHERE tu.user_id = ur.user_id
      ORDER BY CASE WHEN tu.role = 'owner' THEN 0 ELSE 1 END, tu.created_at ASC
      LIMIT 1
    ) ws ON TRUE
    WHERE ur.role = 'tenant'
      AND (
        v_search IS NULL
        OR COALESCE(pr.name, '')::TEXT ILIKE '%' || v_search || '%'
        OR au.email::TEXT ILIKE '%' || v_search || '%'
        OR COALESCE(ws.tname, '')::TEXT ILIKE '%' || v_search || '%'
        OR COALESCE(ws.tslug, '')::TEXT ILIKE '%' || v_search || '%'
      )
      AND (
        p_email_status IS NULL OR COALESCE(array_length(p_email_status, 1), 0) = 0
        OR ('verified' = ANY(p_email_status) AND au.email_confirmed_at IS NOT NULL)
        OR ('pending' = ANY(p_email_status) AND au.email_confirmed_at IS NULL)
      )
      AND (
        p_workspace_status IS NULL OR COALESCE(array_length(p_workspace_status, 1), 0) = 0
        OR ('with_workspace' = ANY(p_workspace_status) AND ws.tname IS NOT NULL)
        OR ('without_workspace' = ANY(p_workspace_status) AND ws.tname IS NULL)
      )
  )
  SELECT
    b.uid,
    b.uname,
    b.uemail,
    b.uemail_confirmed,
    b.uwhatsapp,
    b.ucreated,
    b.ws_name,
    b.ws_slug,
    COUNT(*) OVER() AS total_count
  FROM base b
  ORDER BY
    CASE WHEN v_sort_dir = 'asc' THEN
      CASE v_sort_by
        WHEN 'name' THEN b.uname
        WHEN 'email' THEN b.uemail
        WHEN 'created_at' THEN b.ucreated::TEXT
        ELSE b.ucreated::TEXT
      END
    END ASC NULLS LAST,
    CASE WHEN v_sort_dir = 'desc' THEN
      CASE v_sort_by
        WHEN 'name' THEN b.uname
        WHEN 'email' THEN b.uemail
        WHEN 'created_at' THEN b.ucreated::TEXT
        ELSE b.ucreated::TEXT
      END
    END DESC NULLS LAST
  LIMIT v_page_size
  OFFSET v_offset;
END;
$$;
