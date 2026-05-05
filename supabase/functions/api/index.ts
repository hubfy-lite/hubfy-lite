// Public REST API for Hubfy Lite.
//
// Base URL: https://<seu-project-ref>.supabase.co/functions/v1/api/v1/...
// Auth:     Authorization: Bearer sk_live_<hex>  (API keys)  OR
//           Authorization: Bearer <jwt>          (dashboard sessions)
//
// Tenant is resolved from the API key itself (api_keys.tenant_id) — the caller
// never passes tenant_id. For JWTs, the caller must send X-Hubfy-Workspace-Id
// with the target workspace UUID.
//
// Response shapes:
//   Collection: { data: [...], meta: { page, per_page, total, has_more } }
//   Resource:   { ...resource fields... }
//   Deleted:    { deleted: true, id: "<public_id>" }
//   Error:      { error: { code, message, details? } }

import { createClient } from "jsr:@supabase/supabase-js@2";
import {
  authenticateRequest,
  authorizeWorkspace,
  type WorkspaceAuth,
} from "../_shared/auth.ts";
import {
  jsonResponse,
  toApiErrorResponse,
  ApiError,
  badRequest,
  notFound,
} from "../_shared/api-errors.ts";
import { matchRoute, type Route } from "./router.ts";
import { customersRoutes } from "./routes/customers.ts";
import { productsRoutes } from "./routes/products.ts";
import { ordersRoutes } from "./routes/orders.ts";

const routes: Route[] = [
  ...customersRoutes,
  ...productsRoutes,
  ...ordersRoutes,
];

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-hubfy-workspace-id, idempotency-key",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    // Supabase preserves the function name in the path — strip the leading
    // "/api" so routes declared as "/v1/customers" match.
    const pathname = url.pathname.replace(/^\/api(?=\/|$)/, "") || "/";

    // Health probe (no auth)
    if (pathname === "/v1" || pathname === "/v1/") {
      return jsonResponse(
        { name: "Hubfy API", version: "v1" },
        200,
        corsHeaders,
      );
    }

    // ── Auth ──────────────────────────────────────────
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    const identity = await authenticateRequest(req, admin);

    // Resolve tenant:
    //   - API key → key.tenant_id (authoritative)
    //   - JWT     → X-Hubfy-Workspace-Id header
    let tenantId: string | null = null;
    if (identity.method === "api_key") {
      tenantId = identity.keyTenantId ?? null;
    } else {
      tenantId = req.headers.get("x-hubfy-workspace-id")
        ?? req.headers.get("X-Hubfy-Workspace-Id")
        ?? null;
    }
    if (!tenantId) {
      throw badRequest(
        "missing_workspace",
        "Workspace could not be resolved. Use an API key or send X-Hubfy-Workspace-Id.",
      );
    }

    const auth: WorkspaceAuth = await authorizeWorkspace(identity, tenantId, admin);

    // ── Dispatch ──────────────────────────────────────
    const match = matchRoute(routes, req.method, pathname);
    if (!match) {
      throw notFound("route_not_found", `No route matches ${req.method} ${pathname}`);
    }

    return await match.route.handler({
      req,
      url,
      params: match.params,
      auth,
      client: admin,
      corsHeaders,
    });
  } catch (err) {
    return toApiErrorResponse(err, corsHeaders);
  }
});
