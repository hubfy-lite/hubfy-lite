// /v1/orders — CRUD for orders (tenant-scoped).
//
// List:   GET    /v1/orders                    ?search, ?status, ?source, ?customer_id, ?product_id, ?start_at, ?end_at, ?page, ?per_page
// Get:    GET    /v1/orders/:id                id = public_id (ordr_*)
// Create: POST   /v1/orders                    { customer_id? | customer_email, product_id, unit_amount?, currency?, status?, type?, gateway_external_id?, effective_order_at? }
// Update: PATCH  /v1/orders/:id                { status?, effective_order_at? }
//
// POST is the "sync external" endpoint: external ERP / migration tools create
// orders here. source is always forced to "custom" on this path. If the given
// customer_email does not exist, the customer is created automatically.

import type { Route, RouteContext } from "../router.ts";
import {
  ApiError,
  badRequest,
  jsonResponse,
  notFound,
} from "../../_shared/api-errors.ts";
import { buildMeta, parsePagination } from "../../_shared/api-pagination.ts";
import { isValidPublicId } from "../../_shared/api-public-id.ts";

const VALID_STATUSES = new Set([
  "pending",
  "completed",
  "approved",
  "refunded",
  "cancelled",
]);
const VALID_TYPES = new Set(["one_time", "subscription"]);
const VALID_CURRENCIES = new Set(["USD", "BRL"]);
const EDITABLE_STATUSES = new Set([
  "completed",
  "approved",
  "refunded",
  "cancelled",
]);

function serialize(row: Record<string, unknown>) {
  return {
    id: row.public_id,
    order_number: row.order_number,
    type: row.type,
    status: row.status,
    source: row.source,
    unit_amount: row.unit_amount,
    currency: row.currency,
    customer: {
      id: row.customer_public_id ?? null,
      email: row.customer_email_snapshot ?? row.customer_email ?? null,
      name: row.customer_name_snapshot ?? row.customer_name ?? null,
    },
    product: {
      id: row.product_public_id ?? null,
      name: row.product_name ?? null,
    },
    is_order_bump: row.is_order_bump,
    gateway_external_id: row.gateway_external_id,
    gateway_provider: row.gateway_provider,
    gateway_order_created_at: row.gateway_order_created_at,
    effective_order_at:
      row.effective_order_at ?? row.gateway_order_created_at ?? row.created_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

const SELECT_WITH_RELATIONS = `
  id, public_id, tenant_id, customer_id, product_id, checkout_id, price_id,
  order_number, type, status, source, unit_amount, currency,
  is_order_bump, parent_gateway_external_id, gateway_external_id,
  gateway_provider, gateway_order_created_at, effective_order_at,
  idempotency_key, customer_email_snapshot, customer_name_snapshot,
  created_at, updated_at,
  customers ( public_id, email, name ),
  products  ( public_id, name )
`;

function flattenRelations(row: Record<string, any>) {
  return {
    ...row,
    customer_public_id: row.customers?.public_id ?? null,
    customer_email: row.customers?.email ?? null,
    customer_name: row.customers?.name ?? null,
    product_public_id: row.products?.public_id ?? null,
    product_name: row.products?.name ?? null,
  };
}

function normalizeString(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const trimmed = v.trim();
  return trimmed === "" ? null : trimmed;
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
  const source = normalizeString(url.searchParams.get("source"));
  const customerIdParam = normalizeString(url.searchParams.get("customer_id"));
  const productIdParam = normalizeString(url.searchParams.get("product_id"));
  const startAt = normalizeString(url.searchParams.get("start_at"));
  const endAt = normalizeString(url.searchParams.get("end_at"));

  let query = client
    .from("orders")
    .select(SELECT_WITH_RELATIONS, { count: "exact" })
    .eq("tenant_id", auth.tenantId)
    .order("effective_order_at", { ascending: false })
    .range(pagination.offset, pagination.offset + pagination.perPage - 1);

  if (status) {
    if (!VALID_STATUSES.has(status)) {
      throw badRequest(
        "invalid_status",
        `status must be one of ${Array.from(VALID_STATUSES).join(", ")}`,
      );
    }
    query = query.eq("status", status);
  }
  if (source) query = query.eq("source", source);
  if (startAt) query = query.gte("effective_order_at", startAt);
  if (endAt) query = query.lt("effective_order_at", endAt);

  if (customerIdParam) {
    const internalId = await resolvePublicToInternal(
      client, auth.tenantId, "customers", customerIdParam, "cust",
    );
    query = query.eq("customer_id", internalId);
  }
  if (productIdParam) {
    const internalId = await resolvePublicToInternal(
      client, auth.tenantId, "products", productIdParam, "prod",
    );
    query = query.eq("product_id", internalId);
  }
  if (search) {
    const safe = search.replace(/[,%]/g, " ");
    query = query.or(
      `gateway_external_id.ilike.%${safe}%,customer_email_snapshot.ilike.%${safe}%,customer_name_snapshot.ilike.%${safe}%`,
    );
  }

  const { data, count, error } = await query;
  if (error) throw new ApiError(500, "list_failed", error.message);

  return jsonResponse(
    {
      data: (data ?? []).map((r: any) => serialize(flattenRelations(r))),
      meta: buildMeta(pagination, count ?? 0),
    },
    200,
    corsHeaders,
  );
}

async function resolvePublicToInternal(
  client: RouteContext["client"],
  tenantId: string,
  table: "customers" | "products" | "orders",
  publicId: string,
  prefix: "cust" | "prod" | "ordr",
): Promise<string> {
  if (!isValidPublicId(prefix, publicId)) {
    const name = table.slice(0, -1);
    throw notFound(`${name}_not_found`, `${name} not found`);
  }
  const { data, error } = await client
    .from(table)
    .select("id")
    .eq("public_id", publicId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (error) throw new ApiError(500, "lookup_failed", error.message);
  if (!data) {
    const name = table.slice(0, -1);
    throw notFound(`${name}_not_found`, `${name} not found`);
  }
  return data.id as string;
}

async function get({ client, auth, params, corsHeaders }: RouteContext) {
  if (!isValidPublicId("ordr", params.id)) {
    throw notFound("order_not_found", "Order not found");
  }
  const { data, error } = await client
    .from("orders")
    .select(SELECT_WITH_RELATIONS)
    .eq("public_id", params.id)
    .eq("tenant_id", auth.tenantId)
    .maybeSingle();
  if (error) throw new ApiError(500, "lookup_failed", error.message);
  if (!data) throw notFound("order_not_found", "Order not found");
  return jsonResponse(serialize(flattenRelations(data as any)), 200, corsHeaders);
}

async function create({ client, auth, req, corsHeaders }: RouteContext) {
  const body = await req.json().catch(() => ({}));

  const productPublicId = normalizeString(body.product_id);
  if (!productPublicId) {
    throw badRequest("missing_product_id", "product_id is required");
  }
  const productId = await resolvePublicToInternal(
    client, auth.tenantId, "products", productPublicId, "prod",
  );

  // Resolve customer: either by customer_id (public) or find-or-create by email
  const customerPublicId = normalizeString(body.customer_id);
  const customerEmail = normalizeString(body.customer_email)?.toLowerCase();
  const customerName = normalizeString(body.customer_name);

  let customerId: string;
  if (customerPublicId) {
    customerId = await resolvePublicToInternal(
      client, auth.tenantId, "customers", customerPublicId, "cust",
    );
  } else if (customerEmail) {
    const { data: existing } = await client
      .from("customers")
      .select("id")
      .eq("tenant_id", auth.tenantId)
      .eq("email", customerEmail)
      .maybeSingle();
    if (existing) {
      customerId = existing.id as string;
    } else {
      const { data: created, error: createError } = await client
        .from("customers")
        .insert({
          tenant_id: auth.tenantId,
          email: customerEmail,
          name: customerName ?? customerEmail.split("@")[0],
        })
        .select("id")
        .single();
      if (createError) throw new ApiError(500, "customer_create_failed", createError.message);
      customerId = created.id as string;
    }
  } else {
    throw badRequest(
      "missing_customer",
      "Either customer_id or customer_email is required",
    );
  }

  const status = normalizeString(body.status) ?? "completed";
  if (!VALID_STATUSES.has(status)) {
    throw badRequest(
      "invalid_status",
      `status must be one of ${Array.from(VALID_STATUSES).join(", ")}`,
    );
  }

  const type = normalizeString(body.type) ?? "one_time";
  if (!VALID_TYPES.has(type)) {
    throw badRequest(
      "invalid_type",
      `type must be one of ${Array.from(VALID_TYPES).join(", ")}`,
    );
  }

  const currency = normalizeString(body.currency)?.toUpperCase() ?? "BRL";
  if (!VALID_CURRENCIES.has(currency)) {
    throw badRequest(
      "invalid_currency",
      `currency must be one of ${Array.from(VALID_CURRENCIES).join(", ")}`,
    );
  }

  const unitAmount = validateAmount(body.unit_amount) ?? 0;
  const effectiveOrderAt = normalizeString(body.effective_order_at);
  const gatewayExternalId = normalizeString(body.gateway_external_id);

  // Idempotency: caller can provide Idempotency-Key header or idempotency_key
  // in body. We also store it on the row to prevent duplicate inserts.
  const idempotencyKey =
    req.headers.get("idempotency-key")
      ?? req.headers.get("Idempotency-Key")
      ?? normalizeString(body.idempotency_key);

  if (idempotencyKey) {
    const { data: existing } = await client
      .from("orders")
      .select(SELECT_WITH_RELATIONS)
      .eq("tenant_id", auth.tenantId)
      .eq("idempotency_key", idempotencyKey)
      .maybeSingle();
    if (existing) {
      return jsonResponse(
        serialize(flattenRelations(existing as any)),
        200,
        corsHeaders,
      );
    }
  }

  // Compute next order_number (per-tenant, best-effort).
  const { data: maxRow } = await client
    .from("orders")
    .select("order_number")
    .eq("tenant_id", auth.tenantId)
    .order("order_number", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();
  const nextOrderNumber = ((maxRow?.order_number as number | null) ?? 0) + 1;

  const payload: Record<string, unknown> = {
    tenant_id: auth.tenantId,
    customer_id: customerId,
    product_id: productId,
    status,
    type,
    source: "custom",
    unit_amount: unitAmount,
    currency,
    order_number: nextOrderNumber,
    idempotency_key: idempotencyKey,
    gateway_external_id: gatewayExternalId,
    gateway_order_created_at: effectiveOrderAt,
  };

  const { data, error } = await client
    .from("orders")
    .insert(payload)
    .select(SELECT_WITH_RELATIONS)
    .single();

  if (error) {
    if (error.code === "23505") {
      // Re-query if race on idempotency_key
      if (idempotencyKey) {
        const { data: replay } = await client
          .from("orders")
          .select(SELECT_WITH_RELATIONS)
          .eq("tenant_id", auth.tenantId)
          .eq("idempotency_key", idempotencyKey)
          .maybeSingle();
        if (replay) {
          return jsonResponse(
            serialize(flattenRelations(replay as any)),
            200,
            corsHeaders,
          );
        }
      }
    }
    throw new ApiError(500, "create_failed", error.message);
  }

  return jsonResponse(
    serialize(flattenRelations(data as any)),
    201,
    corsHeaders,
  );
}

async function update({ client, auth, params, req, corsHeaders }: RouteContext) {
  if (!isValidPublicId("ordr", params.id)) {
    throw notFound("order_not_found", "Order not found");
  }
  const body = await req.json().catch(() => ({}));

  const payload: Record<string, unknown> = {};

  if (body.status !== undefined) {
    const status = normalizeString(body.status);
    if (!status || !EDITABLE_STATUSES.has(status)) {
      throw badRequest(
        "invalid_status",
        `status must be one of ${Array.from(EDITABLE_STATUSES).join(", ")}`,
      );
    }
    payload.status = status;
  }
  if (body.effective_order_at !== undefined) {
    // effective_order_at is a generated column (COALESCE of gateway_order_created_at
    // and created_at), so updates land on gateway_order_created_at.
    payload.gateway_order_created_at = normalizeString(body.effective_order_at);
  }

  if (Object.keys(payload).length === 0) {
    throw badRequest("empty_update", "No updatable fields provided");
  }

  const { data, error } = await client
    .from("orders")
    .update(payload)
    .eq("public_id", params.id)
    .eq("tenant_id", auth.tenantId)
    .select(SELECT_WITH_RELATIONS)
    .maybeSingle();

  if (error) throw new ApiError(500, "update_failed", error.message);
  if (!data) throw notFound("order_not_found", "Order not found");

  return jsonResponse(serialize(flattenRelations(data as any)), 200, corsHeaders);
}

export const ordersRoutes: Route[] = [
  { method: "GET",   pattern: "/v1/orders",     handler: list },
  { method: "POST",  pattern: "/v1/orders",     handler: create },
  { method: "GET",   pattern: "/v1/orders/:id", handler: get },
  { method: "PATCH", pattern: "/v1/orders/:id", handler: update },
];
