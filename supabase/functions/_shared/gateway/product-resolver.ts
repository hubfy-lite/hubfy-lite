/**
 * Product Resolver
 *
 * Resolve produto Hubfy a partir do ID externo do gateway
 * via tabela gateway_product_mappings.
 */

import type { AdminClient, ResolvedProduct } from "./types.ts";

export async function resolveProduct(
  admin: AdminClient,
  tenantId: string,
  provider: string,
  externalProductId: string,
): Promise<ResolvedProduct | null> {
  const { data: mapping } = await admin
    .from("gateway_product_mappings")
    .select("product_id, products(id, name, unit_amount)")
    .eq("tenant_id", tenantId)
    .eq("provider", provider)
    .eq("external_product_id", externalProductId)
    .not("product_id", "is", null)
    .maybeSingle();

  if (!mapping?.products) return null;

  const p = mapping.products as { id: string; name: string; unit_amount: number };
  return {
    id: p.id,
    name: p.name,
    unitAmount: p.unit_amount ?? 0,
  };
}
