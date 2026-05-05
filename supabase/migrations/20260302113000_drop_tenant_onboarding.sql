-- Cleanup: onboarding table is deprecated.
-- Current flow creates tenant directly via /admin/new-workspace.

DROP TABLE IF EXISTS public.tenant_onboarding;
DROP TABLE IF EXISTS public.creator_onboarding;
