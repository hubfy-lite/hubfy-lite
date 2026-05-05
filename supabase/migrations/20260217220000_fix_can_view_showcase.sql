-- Fix: can_view_showcase() still referenced old table "showcase_members"
-- which was renamed to "showcase_customers" in 20260217100000.
-- This caused RLS to silently return 0 rows for showcases.

CREATE OR REPLACE FUNCTION public.can_view_showcase(_showcase_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.showcases s
    WHERE s.id = _showcase_id
      AND (
        public.is_tenant_editor(s.tenant_id)
        OR public.is_admin()
        OR (
          public.is_tenant_member(s.tenant_id)
          AND (
            s.is_public = true
            OR EXISTS (
              SELECT 1 FROM public.showcase_customers sc
              WHERE sc.showcase_id = s.id
                AND sc.user_id = auth.uid()
            )
          )
        )
      )
  )
$$;
