-- =============================================================================
-- Phase 2: Drop legacy tables and columns
-- =============================================================================
-- Prerequisite: Phase 1 migration (20260403100000) already:
--   - Migrated tenant_gateways → tenant_integrations + tenant_integration_secrets
--   - Backfilled gateway_product_mappings from products.gateway_product_ids
--   - Added integration_id and gateway_provider to orders and gateway_events
-- =============================================================================

-- ─── 1. Drop legacy columns from orders ─────────────────────────────────────
-- gateway_id is the old FK to tenant_gateways (replaced by integration_id)
ALTER TABLE orders
  DROP COLUMN IF EXISTS gateway_id;

-- ─── 2. Drop legacy column from gateway_events ──────────────────────────────
ALTER TABLE gateway_events
  DROP COLUMN IF EXISTS gateway_id;

-- ─── 3. Drop legacy column from products ────────────────────────────────────
-- Replaced by gateway_product_mappings table
ALTER TABLE products
  DROP COLUMN IF EXISTS gateway_product_ids;

-- ─── 4. Drop legacy table tenant_gateways ───────────────────────────────────
DROP TABLE IF EXISTS tenant_gateways;

-- ─── 5. Clean up: drop any leftover RPC that references old schema ──────────
-- (get_tenant_orders was already updated in Phase 1 to use gateway_provider)
