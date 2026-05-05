// Helpers to validate public_id format and look up rows by public_id
// within a given tenant. Used by every API route that accepts
// :id in the URL (customers, products, orders).

import { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { ApiError, notFound } from "./api-errors.ts";

export type ResourcePrefix = "cust" | "prod" | "ordr";

const PUBLIC_ID_REGEX: Record<ResourcePrefix, RegExp> = {
  cust: /^cust_[a-z0-9]+$/i,
  prod: /^prod_[a-z0-9]+$/i,
  ordr: /^ordr_[a-z0-9]+$/i,
};

export function isValidPublicId(prefix: ResourcePrefix, id: string): boolean {
  return PUBLIC_ID_REGEX[prefix].test(id);
}

/**
 * Looks up a resource by public_id, scoped to tenant_id. Returns only
 * the `id` column (internal UUID). Throws ApiError(404) if not found.
 */
export async function resolvePublicId(
  client: SupabaseClient,
  table: "customers" | "products" | "orders",
  publicId: string,
  tenantId: string,
): Promise<string> {
  const { data, error } = await client
    .from(table)
    .select("id")
    .eq("public_id", publicId)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (error) {
    throw new ApiError(500, "lookup_failed", `Failed to resolve ${table} id`);
  }
  if (!data) {
    throw notFound(`${table.slice(0, -1)}_not_found`, `${table.slice(0, -1)} not found`);
  }
  return data.id as string;
}
