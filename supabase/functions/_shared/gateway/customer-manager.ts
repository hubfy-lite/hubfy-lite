/**
 * Customer Manager
 *
 * Find-or-create customer a partir dos dados do buyer do webhook.
 * Nunca sobrescreve campos existentes com valores vazios.
 */

import type { AdminClient, NormalizedBuyer } from "./types.ts";

export async function findOrCreateCustomer(
  admin: AdminClient,
  tenantId: string,
  buyer: NormalizedBuyer,
): Promise<string | null> {
  const email = buyer.email.trim().toLowerCase();
  if (!email) return null;

  // Tenta encontrar customer existente
  const { data: existing } = await admin
    .from("customers")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("email", email)
    .maybeSingle();

  if (existing) {
    // Atualiza apenas campos que vieram preenchidos (nunca apaga dado existente)
    const updates: Record<string, string> = {};
    if (buyer.name && buyer.name !== email) updates.name = buyer.name;
    if (buyer.phone) updates.phone = buyer.phone;
    if (buyer.firstName) updates.first_name = buyer.firstName;
    if (buyer.lastName) updates.last_name = buyer.lastName;
    if (buyer.document) updates.document = buyer.document;
    if (buyer.documentType) updates.document_type = buyer.documentType;
    if (buyer.address?.city) updates.city = buyer.address.city;
    if (buyer.address?.state) updates.region = buyer.address.state;
    if (buyer.address?.country) updates.country = buyer.address.country;

    if (Object.keys(updates).length > 0) {
      await admin.from("customers").update(updates).eq("id", existing.id);
    }

    return existing.id;
  }

  // Cria novo customer
  const { data: newCustomer, error: custErr } = await admin
    .from("customers")
    .insert({
      tenant_id: tenantId,
      email,
      name: buyer.name?.trim() || email,
      phone: buyer.phone?.trim() || null,
      first_name: buyer.firstName?.trim() || null,
      last_name: buyer.lastName?.trim() || null,
      document: buyer.document?.trim() || null,
      document_type: buyer.documentType?.trim() || null,
      city: buyer.address?.city?.trim() || null,
      region: buyer.address?.state?.trim() || null,
      country: buyer.address?.country?.trim() || null,
    })
    .select("id")
    .single();

  if (custErr) {
    // Race condition: outro webhook criou o customer entre SELECT e INSERT
    if (custErr.message?.includes("duplicate key")) {
      const { data: raceCustomer } = await admin
        .from("customers")
        .select("id")
        .eq("tenant_id", tenantId)
        .eq("email", email)
        .single();
      return raceCustomer?.id ?? null;
    }
    console.error("customer-manager: erro ao criar customer:", custErr.message);
    return null;
  }

  return newCustomer?.id ?? null;
}
