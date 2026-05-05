-- Hardening: restrict get_user_id_by_email to service_role only.
-- This SECURITY DEFINER function reads auth.users by email.
-- Without REVOKE it is callable by anon/authenticated, enabling email enumeration.

REVOKE EXECUTE ON FUNCTION public.get_user_id_by_email(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_user_id_by_email(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_user_id_by_email(text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_id_by_email(text) TO service_role;
