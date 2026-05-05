// /v1/products — CRUD for products (tenant-scoped).
//
// List:   GET    /v1/products                  ?search, ?status, ?benefit, ?page, ?per_page
// Get:    GET    /v1/products/:id              id = public_id (prod_*)
// Create: POST   /v1/products                  { name, description?, status?, cover_url?, benefit?, unit_amount?, currency?, test_mode? }
// Update: PATCH  /v1/products/:id              { ...any subset of editable fields }
// Archive: DELETE /v1/products/:id   (Stripe-style — flips status to archived)

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
  "description",
  "status",
  "cover_url",
  "benefit",
  "unit_amount",
  "currency",
  "test_mode",
  "sort_order",
] as const;

const VALID_STATUSES = new Set(["draft", "active", "archived"]);
const VALID_BENEFITS = new Set(["files", "courses", "links"]);
const VALID_CURRENCIES = new Set(["USD", "BRL"]);

function serialize(row: Record<string, unknown>) {
  return {
    id: row.public_id,
    name: row.name,
    description: row.description,
    cover_url: row.cover_url,
    status: row.status,
    benefit: row.benefit,
    unit_amount: row.unit_amount,
    currency: row.currency,
    test_mode: row.test_mode,
    sort_order: row.sort_order,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function normalizeString(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const trimmed = v.trim();
  return trimmed === "" ? null : trimmed;
}

function validateStatus(value: unknown): string | null {
  const v = normalizeString(value);
  if (v === null) return null;
  if (!VALID_STATUSES.has(v)) {
    throw badRequest(
      "invalid_status",
      `status must be one of ${Array.from(VALID_STATUSES).join(", ")}`,
    );
  }
  return v;
}

function validateBenefit(value: unknown): string | null {
  const v = normalizeString(value);
  if (v === null) return null;
  if (!VALID_BENEFITS.has(v)) {
    throw badRequest(
      "invalid_benefit",
      `benefit must be one of ${Array.from(VALID_BENEFITS).join(", ")}`,
    );
  }
  return v;
}

function validateCurrency(value: unknown): string | null {
  const v = normalizeString(value)?.toUpperCase();
  if (!v) return null;
  if (!VALID_CURRENCIES.has(v)) {
    throw badRequest(
      "invalid_currency",
      `currency must be one of ${Array.from(VALID_CURRENCIES).join(", ")}`,
    );
  }
  return v;
}

function validateAmount(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) {
    throw badRequest(
      "invalid_unit_amount",
      "unit_amount must be a non-negative integer in minor currency units (cents)",
    );
  }
  return n;
}

async function list({ client, auth, url, corsHeaders }: RouteContext) {
  const pagination = parsePagination(url);
  const search = normalizeString(url.searchParams.get("search"));
  const status = normalizeString(url.searchParams.get("status"));
  const benefit = normalizeString(url.searchParams.get("benefit"));

  let query = client
    .from("products")
    .select("*", { count: "exact" })
    .eq("tenant_id", auth.tenantId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false })
    .range(pagination.offset, pagination.offset + pagination.perPage - 1);

  if (search) {
    const safe = search.replace(/[,%]/g, " ");
    query = query.ilike("name", `%${safe}%`);
  }
  if (status) {
    if (!VALID_STATUSES.has(status)) {
      throw badRequest(
        "invalid_status",
        `status must be one of ${Array.from(VALID_STATUSES).join(", ")}`,
      );
    }
    query = query.eq("status", status);
  }
  if (benefit) {
    if (!VALID_BENEFITS.has(benefit)) {
      throw badRequest(
        "invalid_benefit",
        `benefit must be one of ${Array.from(VALID_BENEFITS).join(", ")}`,
      );
    }
    query = query.eq("benefit", benefit);
  }

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
  if (!isValidPublicId("prod", params.id)) {
    throw notFound("product_not_found", "Product not found");
  }
  const { data, error } = await client
    .from("products")
    .select("*")
    .eq("public_id", params.id)
    .eq("tenant_id", auth.tenantId)
    .maybeSingle();
  if (error) throw new ApiError(500, "lookup_failed", error.message);
  if (!data) throw notFound("product_not_found", "Product not found");
  return jsonResponse(serialize(data), 200, corsHeaders);
}

async function create({ client, auth, req, corsHeaders }: RouteContext) {
  const body = await req.json().catch(() => ({}));

  const name = normalizeString(body.name);
  if (!name) throw badRequest("missing_name", "name is required");

  const status = validateStatus(body.status) ?? "draft";
  const benefit = validateBenefit(body.benefit);
  const currency = validateCurrency(body.currency) ?? "BRL";
  const unitAmount = validateAmount(body.unit_amount) ?? 0;

  const payload: Record<string, unknown> = {
    tenant_id: auth.tenantId,
    name,
    description: normalizeString(body.description),
    cover_url: normalizeString(body.cover_url),
    status,
    benefit,
    unit_amount: unitAmount,
    currency,
    test_mode: body.test_mode === true,
  };

  const { data, error } = await client
    .from("products")
    .insert(payload)
    .select("*")
    .single();

  if (error) throw new ApiError(500, "create_failed", error.message);
  return jsonResponse(serialize(data), 201, corsHeaders);
}

async function update({ client, auth, params, req, corsHeaders }: RouteContext) {
  if (!isValidPublicId("prod", params.id)) {
    throw notFound("product_not_found", "Product not found");
  }
  const body = await req.json().catch(() => ({}));

  const payload: Record<string, unknown> = {};
  for (const field of EDITABLE_FIELDS) {
    if (body[field] === undefined) continue;
    const value = body[field];
    switch (field) {
      case "status":
        payload[field] = validateStatus(value);
        break;
      case "benefit":
        payload[field] = validateBenefit(value);
        break;
      case "currency":
        payload[field] = validateCurrency(value);
        break;
      case "unit_amount":
      case "sort_order":
        payload[field] = validateAmount(value);
        break;
      case "test_mode":
        payload[field] = value === true;
        break;
      default:
        payload[field] = normalizeString(value);
    }
  }

  if (Object.keys(payload).length === 0) {
    throw badRequest("empty_update", "No updatable fields provided");
  }

  const { data, error } = await client
    .from("products")
    .update(payload)
    .eq("public_id", params.id)
    .eq("tenant_id", auth.tenantId)
    .select("*")
    .maybeSingle();

  if (error) throw new ApiError(500, "update_failed", error.message);
  if (!data) throw notFound("product_not_found", "Product not found");

  return jsonResponse(serialize(data), 200, corsHeaders);
}

async function destroy({ client, auth, params, corsHeaders }: RouteContext) {
  if (!isValidPublicId("prod", params.id)) {
    throw notFound("product_not_found", "Product not found");
  }

  // Stripe-style archive: historical orders keep pointing at a real product row,
  // just inactive. No DB cascade, no FK null-out, no snapshot columns needed.
  const { data, error } = await client
    .from("products")
    .update({ status: "archived" })
    .eq("public_id", params.id)
    .eq("tenant_id", auth.tenantId)
    .select("public_id, status")
    .maybeSingle();

  if (error) throw new ApiError(500, "archive_failed", error.message);
  if (!data) throw notFound("product_not_found", "Product not found");

  return jsonResponse(
    { archived: true, id: data.public_id, status: data.status },
    200,
    corsHeaders,
  );
}

export const productsRoutes: Route[] = [
  { method: "GET",    pattern: "/v1/products",     handler: list },
  { method: "POST",   pattern: "/v1/products",     handler: create },
  { method: "GET",    pattern: "/v1/products/:id", handler: get },
  { method: "PATCH",  pattern: "/v1/products/:id", handler: update },
  { method: "DELETE", pattern: "/v1/products/:id", handler: destroy },
];
