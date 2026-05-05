-- ═══════════════════════════════════════════════════════
-- Hardening: REVOKE/GRANT no validate_api_key
-- Consistência com outros RPCs SECURITY DEFINER do projeto
-- ═══════════════════════════════════════════════════════

REVOKE EXECUTE ON FUNCTION public.validate_api_key(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.validate_api_key(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.validate_api_key(text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.validate_api_key(text) TO service_role;
