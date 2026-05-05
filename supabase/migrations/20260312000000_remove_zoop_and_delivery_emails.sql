-- ============================================================
-- Refactor: Remover Zoop + Sistema de Delivery Emails
--
-- Decisão de negócio: Zoop nunca foi usado em produção.
-- delivery_emails está sendo substituído pelo acesso via portal.
-- Dados descartados intencionalmente.
-- ============================================================

-- Remove Zoop columns from orders
ALTER TABLE orders DROP COLUMN IF EXISTS zoop_transaction_id;

-- Remove Zoop columns from tenant_settings
ALTER TABLE tenant_settings DROP COLUMN IF EXISTS zoop_seller_id;
ALTER TABLE tenant_settings DROP COLUMN IF EXISTS zoop_seller_type;
ALTER TABLE tenant_settings DROP COLUMN IF EXISTS zoop_seller_status;
ALTER TABLE tenant_settings DROP COLUMN IF EXISTS zoop_bank_account_id;

-- Remove delivery emails system
DROP TABLE IF EXISTS delivery_emails;
DROP TYPE IF EXISTS delivery_email_status;
