/**
 * Adapter Registry
 *
 * Mapeia provider name → adapter.
 * Para adicionar um novo gateway, basta importar e adicionar aqui.
 */

import type { ProviderAdapter } from "../types.ts";
import { hotmartAdapter } from "./hotmart.ts";

const ADAPTERS: Record<string, ProviderAdapter> = {
  hotmart: hotmartAdapter,
};

export function getAdapter(provider: string): ProviderAdapter | null {
  return ADAPTERS[provider] ?? null;
}

export const KNOWN_PROVIDERS = Object.keys(ADAPTERS);
