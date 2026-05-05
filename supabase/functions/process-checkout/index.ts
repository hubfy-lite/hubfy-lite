import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/* ─── CORS: restrict to known origins ─── */

const ALLOWED_ORIGINS = (Deno.env.get("CHECKOUT_ALLOWED_ORIGINS") || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

function getAllowedOrigin(req: Request): string {
  const origin = req.headers.get("origin") || "";

  // Dev mode: allow localhost
  if (
    origin.startsWith("http://localhost:") ||
    origin.startsWith("http://127.0.0.1:")
  ) {
    return origin;
  }

  // Check against allowed list (env var CHECKOUT_ALLOWED_ORIGINS)
  if (ALLOWED_ORIGINS.length > 0) {
    if (ALLOWED_ORIGINS.includes(origin)) return origin;
    // No match — still return empty so CORS headers are present but restrictive
    return "";
  }

  // Fallback: if no allowed origins configured, allow the origin
  // (graceful migration — set CHECKOUT_ALLOWED_ORIGINS in prod to lock down)
  return origin;
}

function corsHeaders(req: Request) {
  return {
    "Access-Control-Allow-Origin": getAllowedOrigin(req),
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
}

function jsonResponse(
  body: Record<string, unknown>,
  status: number,
  req: Request,
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), "Content-Type": "application/json" },
  });
}

/* ─── In-memory rate limiter (per-isolate, resets on cold start) ─── */

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_MAX = 5; // max 5 requests per IP per minute

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }

  entry.count++;
  if (entry.count > RATE_LIMIT_MAX) {
    return true;
  }
  return false;
}

// Periodic cleanup to prevent memory leak (every 5 min)
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of rateLimitMap) {
    if (now > val.resetAt) rateLimitMap.delete(key);
  }
}, 300_000);

interface CheckoutWithJoins {
  id: string;
  product_id: string;
  price_id: string;
  status: string;
  total_orders: number | null;
  products: { id: string; tenant_id: string; name: string; status: string; benefit: string | null };
  prices: { id: string; unit_amount: number; currency: string };
}

/* ─── Handler ─── */

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders(req) });
  }

  // Only allow POST
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed", code: "method_not_allowed" }, 405, req);
  }

  try {
    // Rate limit by IP
    const clientIp =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("cf-connecting-ip") ||
      "unknown";

    if (isRateLimited(clientIp)) {
      return jsonResponse(
        { error: "Too many attempts. Please wait a moment.", code: "rate_limited" },
        429,
        req,
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Parse body
    const { checkout_id, name, email, phone, idempotency_key } =
      await req.json();

    if (!checkout_id || typeof checkout_id !== "string") {
      return jsonResponse({ error: "checkout_id is required", code: "missing_required_field" }, 400, req);
    }
    if (!email || typeof email !== "string") {
      return jsonResponse({ error: "Email is required", code: "missing_required_field" }, 400, req);
    }
    if (!name || typeof name !== "string" || !name.trim()) {
      return jsonResponse({ error: "Name is required", code: "missing_required_field" }, 400, req);
    }
    if (!idempotency_key || typeof idempotency_key !== "string") {
      return jsonResponse(
        { error: "idempotency_key is required", code: "missing_required_field" },
        400,
        req,
      );
    }

    const normalizedEmail = email.trim().toLowerCase();
    const trimmedName = name.trim();

    // 2. Check idempotency — if an order with this key exists, return it
    const { data: existingOrder } = await supabaseAdmin
      .from("orders")
      .select("id")
      .eq("idempotency_key", idempotency_key)
      .maybeSingle();

    if (existingOrder) {
      // Already processed — return success (idempotent response)
      // Fetch the tenant slug for the portal URL
      const { data: orderCheckout } = await supabaseAdmin
        .from("orders")
        .select("tenant_id")
        .eq("id", existingOrder.id)
        .single();

      let portalUrl = "/";
      if (orderCheckout) {
        const { data: tenant } = await supabaseAdmin
          .from("tenants")
          .select("slug")
          .eq("id", orderCheckout.tenant_id)
          .single();
        if (tenant) portalUrl = `/${tenant.slug}`;
      }

      return jsonResponse(
        {
          success: true,
          order_id: existingOrder.id,
          customer_portal_url: portalUrl,
          is_new_user: false,
          idempotent_replay: true,
        },
        200,
        req,
      );
    }

    // 3. Fetch checkout + product + price (validate active + free)
    const { data: checkout, error: checkoutError } = await supabaseAdmin
      .from("checkouts")
      .select(
        "*, products!inner(id, tenant_id, name, status, benefit), prices!inner(id, unit_amount, currency)",
      )
      .eq("id", checkout_id)
      .eq("status", "active")
      .single();

    if (checkoutError || !checkout) {
      return jsonResponse(
        { error: "Checkout not found or inactive", code: "checkout_not_found" },
        404,
        req,
      );
    }

    const typedCheckout = checkout as unknown as CheckoutWithJoins;
    const product = typedCheckout.products;
    const price = typedCheckout.prices;
    const tenantId = product.tenant_id;

    if (product.status !== "active") {
      return jsonResponse(
        { error: "Product is not active", code: "product_not_active" },
        400,
        req,
      );
    }

    // v1: only free checkouts
    if (price.unit_amount !== 0) {
      return jsonResponse(
        { error: "Paid checkouts not supported in this version", code: "paid_checkout_unsupported" },
        400,
        req,
      );
    }

    // 4. Get tenant slug
    const { data: tenant } = await supabaseAdmin
      .from("tenants")
      .select("slug")
      .eq("id", tenantId)
      .single();

    if (!tenant) {
      return jsonResponse({ error: "Workspace not found", code: "tenant_not_found" }, 404, req);
    }

    // 5. Find-or-create customer by email (sem depender de auth.user)
    const { data: existingCustomer } = await supabaseAdmin
      .from("customers")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("email", normalizedEmail)
      .maybeSingle();

    let customerId: string;

    if (existingCustomer) {
      customerId = existingCustomer.id;
    } else {
      const { data: newCustomer, error: customerError } = await supabaseAdmin
        .from("customers")
        .insert({
          tenant_id: tenantId,
          name: trimmedName,
          email: normalizedEmail,
          phone: phone || null,
        })
        .select("id")
        .single();

      if (customerError) {
        // Handle race condition — another request might have created it
        if (
          customerError.message?.includes("unique") ||
          customerError.message?.includes("duplicate")
        ) {
          const { data: raceCustomer } = await supabaseAdmin
            .from("customers")
            .select("id")
            .eq("tenant_id", tenantId)
            .eq("email", normalizedEmail)
            .single();

          customerId = raceCustomer!.id;
        } else {
          throw customerError;
        }
      } else {
        customerId = newCustomer.id;
      }
    }

    // 6. Create order + increment counter
    const [orderResult] = await Promise.all([
      supabaseAdmin
        .from("orders")
        .insert({
          tenant_id: tenantId,
          customer_id: customerId,
          product_id: checkout.product_id,
          checkout_id: checkout.id,
          price_id: checkout.price_id,
          status: "completed",
          unit_amount: 0,
          currency: price.currency,
          source: "hubfy",
          idempotency_key,
        })
        .select("id")
        .single(),

      // Increment checkout total_orders (fire-and-forget)
      supabaseAdmin
        .rpc("increment_checkout_orders", {
          p_checkout_id: checkout.id,
        })
        .then(() => {})
        .catch(() => {
          supabaseAdmin
            .from("checkouts")
            .update({ total_orders: (typedCheckout.total_orders || 0) + 1 })
            .eq("id", checkout.id);
        }),
    ]);

    if (orderResult.error) {
      // If the idempotency key caused a unique violation, treat as success
      if (
        orderResult.error.message?.includes("unique") ||
        orderResult.error.message?.includes("duplicate") ||
        orderResult.error.code === "23505"
      ) {
        const { data: dupeOrder } = await supabaseAdmin
          .from("orders")
          .select("id")
          .eq("idempotency_key", idempotency_key)
          .single();

        return jsonResponse(
          {
            success: true,
            order_id: dupeOrder?.id,
            customer_portal_url: `/${tenant.slug}`,
            idempotent_replay: true,
          },
          200,
          req,
        );
      }
      throw orderResult.error;
    }

    const orderId = orderResult.data!.id;

    // 7. Reconciliar acesso: identidade + cursos + email (via reconcile-access)
    // DB trigger handle_order_access já rodou no INSERT, reconcile-access é safety net
    supabaseAdmin.functions.invoke("reconcile-access", {
      body: {
        order_id: orderId,
        trigger_source: "checkout",
      },
    }).catch((err: unknown) =>
      console.error("reconcile-access trigger error:", err),
    );

    return jsonResponse(
      {
        success: true,
        order_id: orderId,
        customer_portal_url: `/${tenant.slug}`,
      },
      200,
      req,
    );
  } catch (error: unknown) {
    console.error("process-checkout error:", error);
    return jsonResponse(
      { error: error instanceof Error ? error.message : "Erro interno do servidor" },
      500,
      req,
    );
  }
});
