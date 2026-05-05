// /v1/customers — CRUD for customers (tenant-scoped).
//
// List:   GET    /v1/customers                  ?search, ?email, ?email_marketing_status, ?page, ?per_page
// Get:    GET    /v1/customers/:id              id = public_id (cust_*)
// Create: POST   /v1/customers                  { email, name, first_name?, last_name?, phone?, document?, document_type?, city?, region?, country?, email_marketing_status? }
// Update: PATCH  /v1/customers/:id              { ...any subset of editable fields }
// Delete: DELETE /v1/customers/:id              Hard-deletes the customer. Related orders are preserved (FK → SET NULL; snapshots retain name/email).

import type { Route, RouteContext } from "../router.ts";
import {
  ApiError,
  badRequest,
  jsonResponse,
  notFound,
} from "../../_shared/api-errors.ts";
import { buildMeta, parsePagination } from "../../_shared/api-pagination.ts";
import { isValidPublicId } from "../../_shared/api-public-id.ts";

const EDITABLE_FIELDS = [
  "name",
  "first_name",
  "last_name",
  "phone",
  "document",
  "document_type",
  "city",
  "region",
  "country",
  "email_marketing_status",
] as const;

const MARKETING_STATUSES = new Set([
  "subscribed",
  "unsubscribed",
  "archived",
  "requires_verification",
  "invalid_email",
  "bounced",
]);

function serialize(row: Record<string, unknown>) {
  return {
    id: row.public_id,
    email: row.email,
    name: row.name,
    first_name: row.first_name,
    last_name: row.last_name,
    phone: row.phone,
    document: row.document,
    document_type: row.document_type,
    city: row.city,
    region: row.region,
    country: row.country,
    email_marketing_status: row.email_marketing_status,
    total_revenue_cents: row.total_revenue_cents,
    mrr_cents: row.mrr_cents,
    currency: row.currency,
    external_id: row.external_id,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function normalizeString(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const trimmed = v.trim();
  return trimmed === "" ? null : trimmed;
}

async function list({ client, auth, url, corsHeaders }: RouteContext) {
  const pagination = parsePagination(url);
  const search = normalizeString(url.searchParams.get("search"));
  const email = normalizeString(url.searchParams.get("email"))?.toLowerCase() ?? null;
  const marketing = normalizeString(url.searchParams.get("email_marketing_status"));

  let query = client
    .from("customers")
    .select("*", { count: "exact" })
    .eq("tenant_id", auth.tenantId)
    .order("created_at", { ascending: false })
    .range(pagination.offset, pagination.offset + pagination.perPage - 1);

  if (search) {
    const safe = search.replace(/[,%]/g, " ");
    query = query.or(`name.ilike.%${safe}%,email.ilike.%${safe}%`);
  }
  if (email) query = query.eq("email", email);
  if (marketing) query = query.eq("email_marketing_status", marketing);

  const { data, count, error } = await query;
  if (error) throw new ApiError(500, "list_failed", error.message);

  return jsonResponse(
    {
      data: (data ?? []).map(serialize),
      meta: buildMeta(pagination, count ?? 0),
    },
    200,
    corsHeaders,
  );
}

async function get({ client, auth, params, corsHeaders }: RouteContext) {
  if (!isValidPublicId("cust", params.id)) {
    throw notFound("customer_not_found", "Customer not found");
  }
  const { data, error } = await client
    .from("customers")
    .select("*")
    .eq("public_id", params.id)
    .eq("tenant_id", auth.tenantId)
    .maybeSingle();
  if (error) throw new ApiError(500, "lookup_failed", error.message);
  if (!data) throw notFound("customer_not_found", "Customer not found");
  return jsonResponse(serialize(data), 200, corsHeaders);
}

async function create({ client, auth, req, corsHeaders }: RouteContext) {
  const body = await req.json().catch(() => ({}));

  const email = normalizeString(body.email)?.toLowerCase();
  const name = normalizeString(body.name)
    ?? [normalizeString(body.first_name), normalizeString(body.last_name)]
      .filter(Boolean)
      .join(" ")
      .trim()
    ?? null;

  if (!email) throw badRequest("missing_email", "email is required");
  if (!name) throw badRequest("missing_name", "name is required");

  const marketing = normalizeString(body.email_marketing_status);
  if (marketing && !MARKETING_STATUSES.has(marketing)) {
    throw badRequest(
      "invalid_email_marketing_status",
      `email_marketing_status must be one of ${Array.from(MARKETING_STATUSES).join(", ")}`,
    );
  }

  const payload: Record<string, unknown> = {
    tenant_id: auth.tenantId,
    email,
    name,
    first_name: normalizeString(body.first_name),
    last_name: normalizeString(body.last_name),
    phone: normalizeString(body.phone),
    document: normalizeString(body.document),
    document_type: normalizeString(body.document_type)?.toUpperCase() ?? null,
    city: normalizeString(body.city),
    region: normalizeString(body.region),
    country: normalizeString(body.country),
    email_marketing_status: marketing ?? "subscribed",
    external_id: normalizeString(body.external_id),
  };

  // Permissive: if a customer with the same (tenant_id, email) already exists,
  // treat as "upsert" — update empty fields and return the existing row.
  const { data: existing } = await client
    .from("customers")
    .select("*")
    .eq("tenant_id", auth.tenantId)
    .eq("email", email)
    .maybeSingle();

  if (existing) {
    const updates: Record<string, unknown> = {};
    for (const key of Object.keys(payload)) {
      if (key === "tenant_id" || key === "email") continue;
      const next = payload[key];
      if (next !== null && !existing[key]) updates[key] = next;
    }
    if (Object.keys(updates).length > 0) {
      const { data: updated, error: updateError } = await client
        .from("customers")
        .update(updates)
        .eq("id", existing.id)
        .select("*")
        .single();
      if (updateError) throw new ApiError(500, "update_failed", updateError.message);
      return jsonResponse(serialize(updated), 200, corsHeaders);
    }
    return jsonResponse(serialize(existing), 200, corsHeaders);
  }

  const { data, error } = await client
    .from("customers")
    .insert(payload)
    .select("*")
    .single();
  if (error) throw new ApiError(500, "create_failed", error.message);

  return jsonResponse(serialize(data), 201, corsHeaders);
}

async function update({ client, auth, params, req, corsHeaders }: RouteContext) {
  if (!isValidPublicId("cust", params.id)) {
    throw notFound("customer_not_found", "Customer not found");
  }
  const body = await req.json().catch(() => ({}));

  const payload: Record<string, unknown> = {};
  for (const field of EDITABLE_FIELDS) {
    if (body[field] === undefined) continue;
    const value = body[field];
    if (field === "email_marketing_status") {
      const v = normalizeString(value);
      if (v && !MARKETING_STATUSES.has(v)) {
        throw badRequest(
          "invalid_email_marketing_status",
          `email_marketing_status must be one of ${Array.from(MARKETING_STATUSES).join(", ")}`,
        );
      }
      payload[field] = v ?? null;
      continue;
    }
    if (field === "document_type") {
      payload[field] = normalizeString(value)?.toUpperCase() ?? null;
      continue;
    }
    payload[field] = normalizeString(value);
  }

  if (Object.keys(payload).length === 0) {
    throw badRequest("empty_update", "No updatable fields provided");
  }

  const { data, error } = await client
    .from("customers")
    .update(payload)
    .eq("public_id", params.id)
    .eq("tenant_id", auth.tenantId)
    .select("*")
    .maybeSingle();

  if (error) throw new ApiError(500, "update_failed", error.message);
  if (!data) throw notFound("customer_not_found", "Customer not found");

  return jsonResponse(serialize(data), 200, corsHeaders);
}

async function destroy({ client, auth, params, corsHeaders }: RouteContext) {
  if (!isValidPublicId("cust", params.id)) {
    throw notFound("customer_not_found", "Customer not found");
  }
  const { data, error } = await client
    .from("customers")
    .delete()
    .eq("public_id", params.id)
    .eq("tenant_id", auth.tenantId)
    .select("public_id")
    .maybeSingle();

  if (error) throw new ApiError(500, "delete_failed", error.message);
  if (!data) throw notFound("customer_not_found", "Customer not found");

  return jsonResponse({ deleted: true, id: data.public_id }, 200, corsHeaders);
}

export const customersRoutes: Route[] = [
  { method: "GET",    pattern: "/v1/customers",     handler: list },
  { method: "POST",   pattern: "/v1/customers",     handler: create },
  { method: "GET",    pattern: "/v1/customers/:id", handler: get },
  { method: "PATCH",  pattern: "/v1/customers/:id", handler: update },
  { method: "DELETE", pattern: "/v1/customers/:id", handler: destroy },
];
