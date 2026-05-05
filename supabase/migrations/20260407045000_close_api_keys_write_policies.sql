-- ═══════════════════════════════════════════════════════
-- Fechar policies de escrita em api_keys
-- Toda escrita agora passa pela edge function api-key-manage (adminClient/service_role)
-- A policy de SELECT permanece para listagem via userClient
-- ═══════════════════════════════════════════════════════

DROP POLICY IF EXISTS "Owners can create api_keys" ON public.api_keys;
DROP POLICY IF EXISTS "Owners can revoke api_keys" ON public.api_keys;
