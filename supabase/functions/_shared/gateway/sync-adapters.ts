/**
 * Sync Adapter Registry
 *
 * Mapeia provider → SyncAdapter para listing de produtos.
 * Espelho do adapters/index.ts (que mapeia provider → ProviderAdapter para webhooks).
 *
 * Para adicionar um novo gateway com API de produtos:
 * 1. Criar {provider}-api.ts com fetch + normalize
 * 2. Registrar aqui
 */

import type { SyncAdapter, SalesSyncAdapter } from "./sync-types.ts";
import {
  parseHotmartCredentials,
  getAccessToken as getHotmartToken,
  fetchProducts as fetchHotmartProducts,
  normalizeHotmartProducts,
  fetchHotmartSales,
  normalizeHotmartSales,
} from "./hotmart-api.ts";

/* ─── Hotmart Sync Adapter ───────────────────────────────── */

const hotmartSyncAdapter: SyncAdapter = {
  async fetchAndNormalize(credentials, existingMappings) {
    const creds = parseHotmartCredentials(credentials.basic_auth);
    const token = await getHotmartToken(creds);
    const products = await fetchHotmartProducts(token);
    return normalizeHotmartProducts(products, existingMappings);
  },
};

/* ─── Registry ───────────────────────────────────────────── */

const SYNC_ADAPTERS: Record<string, SyncAdapter> = {
  hotmart: hotmartSyncAdapter,
};

export function getSyncAdapter(provider: string): SyncAdapter | null {
  return SYNC_ADAPTERS[provider] ?? null;
}

export const SYNC_PROVIDERS = Object.keys(SYNC_ADAPTERS);

/* ═══════════════════════════════════════════════════════════
 * Sales Sync Adapters
 * ═══════════════════════════════════════════════════════════ */

const hotmartSalesSyncAdapter: SalesSyncAdapter = {
  async fetchAndNormalize(credentials, dateRange, existingOrderIds, productMappings) {
    const creds = parseHotmartCredentials(credentials.basic_auth);
    const token = await getHotmartToken(creds);
    const sales = await fetchHotmartSales(token, dateRange.startMs, dateRange.endMs);
    return normalizeHotmartSales(sales, existingOrderIds, productMappings);
  },
};

const SALES_SYNC_ADAPTERS: Record<string, SalesSyncAdapter> = {
  hotmart: hotmartSalesSyncAdapter,
};

export function getSalesSyncAdapter(provider: string): SalesSyncAdapter | null {
  return SALES_SYNC_ADAPTERS[provider] ?? null;
}
