-- Troca o prefixo de tenants: tnnt → hub
-- Recalcula todos os public_ids existentes automaticamente.
SELECT public.change_public_id_prefix('tenants', 'hub');
