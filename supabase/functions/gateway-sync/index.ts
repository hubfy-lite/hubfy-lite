/**
 * Gateway Sync V2
 *
 * Importa produtos ou vendas do gateway para a Hubfy em 2 passos:
 *
 * action: "fetch"  → Busca do gateway, normaliza, retorna lista/resumo (zero writes)
 * action: "import" → Re-busca do gateway, cria registros no banco
 *
 * Body:
 *   fetch products:  { action: "fetch",  tenant_id, integration_id?, resource_type?: "products" }
 *   import products: { action: "import", tenant_id, integration_id?, resource_type?: "products", selected_external_ids: string[] }
 *   fetch orders:    { action: "fetch",  tenant_id, integration_id,  resource_type: "orders" }
 *   import orders:   { action: "import", tenant_id, integration_id,  resource_type: "orders" }
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { authenticateRequest, authorizeWorkspace, toErrorResponse } from "../_shared/auth.ts";
import { getSyncAdapter, getSalesSyncAdapter } from "../_shared/gateway/sync-adapters.ts";
import { findOrCreateCustomer } from "../_shared/gateway/customer-manager.ts";
import {
  IMPORTABLE_STATUSES,
  ACTIVE_REVENUE_STATUSES,
  type NormalizedGatewaySale,
  type SalesSyncSummary,
} from "../_shared/gateway/sync-types.ts";

const PAYMENT_PROVIDERS = ["hotmart"];
const MAX_SALES_CAP = 2000;

/** Chaves de credencial necessárias por provider para sync API */
const REQUIRED_CREDENTIALS: Record<string, string[]> = {
  hotmart: ["basic_auth"],
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/* ── Main ── */

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    /* ── Auth ── */
    const identity = await authenticateRequest(req, admin);

    /* ── Parse body ── */
    let tenantId: string;
    let action: string;
    let resourceType: string;
    let integrationId: string | null = null;
    let selectedExternalIds: string[] = [];
    try {
      const body = await req.json();
      tenantId = body.tenant_id;
      action = body.action ?? "fetch";
      resourceType = body.resource_type ?? "products";
      integrationId = body.integration_id ?? null;
      if (body.selected_external_ids) {
        selectedExternalIds = body.selected_external_ids;
      }
    } catch {
      return json({ error: "Invalid request body", code: "invalid_body" }, 400);
    }

    if (!tenantId) {
      return json({ error: "tenant_id is required", code: "missing_required_field" }, 400);
    }
    if (!["fetch", "import"].includes(action)) {
      return json({ error: "action must be 'fetch' or 'import'", code: "invalid_body" }, 400);
    }
    if (!["products", "orders"].includes(resourceType)) {
      return json({ error: "resource_type must be 'products' or 'orders'", code: "invalid_body" }, 400);
    }
    if (resourceType === "products" && action === "import" && (!Array.isArray(selectedExternalIds) || selectedExternalIds.length === 0)) {
      return json({ error: "selected_external_ids is required to import products", code: "missing_required_field" }, 400);
    }
    if (resourceType === "orders" && !integrationId) {
      return json({ error: "integration_id is required to sync sales", code: "missing_required_field" }, 400);
    }

    /* ── Permissão editor ── */
    const auth = await authorizeWorkspace(identity, tenantId, admin, { minRole: "editor" });

    /* ── Resolver integração ── */
    let integration: { id: string; provider: string; status: string };

    if (integrationId) {
      // Buscar integração por ID (validar que pertence ao tenant)
      const { data: intData, error: intError } = await admin
        .from("tenant_integrations")
        .select("id, provider, status")
        .eq("id", integrationId)
        .eq("tenant_id", tenantId)
        .in("provider", PAYMENT_PROVIDERS)
        .maybeSingle();

      if (intError || !intData) {
        return json({ error: "Integration not found", code: "integration_not_found" }, 404);
      }
      integration = intData;
    } else {
      // Retrocompatibilidade: auto-selecionar gateway ativo
      const { data: intData, error: intError } = await admin
        .from("tenant_integrations")
        .select("id, provider, status")
        .eq("tenant_id", tenantId)
        .eq("status", "active")
        .in("provider", PAYMENT_PROVIDERS)
        .maybeSingle();

      if (intError || !intData) {
        return json({ error: "No payment gateway connected", code: "integration_not_found" }, 404);
      }
      integration = intData;
    }

    /* ── Buscar secrets ── */
    const { data: secretRow, error: secError } = await admin
      .from("tenant_integration_secrets")
      .select("credentials")
      .eq("integration_id", integration.id)
      .maybeSingle();

    if (secError || !secretRow) {
      return json({ error: "Credentials not found", code: "invalid_credentials" }, 404);
    }

    const creds = secretRow.credentials as Record<string, string>;
    const requiredKeys = REQUIRED_CREDENTIALS[integration.provider] ?? [];
    const missingKeys = requiredKeys.filter((k) => !creds[k]);
    if (missingKeys.length > 0) {
      return json({
        error: "Configure the API credentials in the General tab to sync",
        code: "invalid_credentials",
      }, 400);
    }

    /* ── Route by resource_type ── */
    if (resourceType === "products") {
      return await handleProducts(admin, admin, auth.userId, tenantId, integration, creds, action, selectedExternalIds);
    }
    return await handleOrders(admin, auth.userId, tenantId, integration, creds, action);

  } catch (err) {
    console.error("gateway-sync error:", err);
    return toErrorResponse(err, corsHeaders);
  }
});

/* ══════════════════════════════════════════════════════════════
 * PRODUCTS (lógica existente, sem mudanças funcionais)
 * ══════════════════════════════════════════════════════════════ */

async function handleProducts(
  admin: ReturnType<typeof createClient>,
  _userClient: ReturnType<typeof createClient>,
  userId: string,
  tenantId: string,
  integration: { id: string; provider: string },
  creds: Record<string, string>,
  action: string,
  selectedExternalIds: string[],
): Promise<Response> {
  const adapter = getSyncAdapter(integration.provider);
  if (!adapter) {
    return json({ error: `API sync not available for ${integration.provider}`, code: "integration_not_found" }, 400);
  }

  /* ── Buscar mappings existentes ── */
  const { data: existingMappings } = await admin
    .from("gateway_product_mappings")
    .select("external_product_id, product_id")
    .eq("integration_id", integration.id);

  const mappingsMap = new Map<string, string | null>();
  for (const m of existingMappings ?? []) {
    mappingsMap.set(m.external_product_id, m.product_id);
  }

  /* ── FETCH ── */
  if (action === "fetch") {
    try {
      const products = await adapter.fetchAndNormalize(creds, mappingsMap);
      return json({ products });
    } catch (err) {
      console.error("gateway-sync fetch error:", err);
      const msg = err instanceof Error ? err.message : String(err);
      return json({ error: msg, code: "connect_failed" }, 500);
    }
  }

  /* ── IMPORT ── */
  let allProducts;
  try {
    allProducts = await adapter.fetchAndNormalize(creds, mappingsMap);
  } catch (err) {
    console.error("gateway-sync import fetch error:", err);
    const msg = err instanceof Error ? err.message : String(err);
    return json({ error: "fetch_failed", reason: msg }, 500);
  }

  const selectedSet = new Set(selectedExternalIds);
  const toImport = allProducts.filter(
    (p) => selectedSet.has(p.external_id) && !p.already_imported,
  );

  if (toImport.length === 0) {
    return json({ error: "No eligible products to import", code: "import_failed" }, 400);
  }

  const { data: job, error: jobError } = await admin
    .from("gateway_sync_jobs")
    .insert({
      tenant_id: tenantId,
      integration_id: integration.id,
      provider: integration.provider,
      resource_type: "products",
      status: "running",
      total_items: toImport.length,
      started_by: userId,
    })
    .select()
    .single();

  if (jobError) {
    if (jobError.code === "23505") {
      return json({ error: "An import is already running", code: "rate_limited" }, 409);
    }
    console.error("gateway-sync: failed to create job:", jobError);
    return json({ error: "Failed to create job", code: "internal_error" }, 500);
  }

  const { data: maxSortRow } = await admin
    .from("products")
    .select("sort_order")
    .eq("tenant_id", tenantId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  let currentSort = maxSortRow?.sort_order ?? 0;
  let createdCount = 0;
  let skippedCount = 0;
  let errorCount = 0;
  let processedItems = 0;
  const errors: Array<{ external_id: string; name: string; message: string }> = [];

  for (const np of toImport) {
    try {
      const orphanMapping = mappingsMap.has(np.external_id) && mappingsMap.get(np.external_id) === null;

      currentSort++;
      const { data: newProduct, error: prodError } = await admin
        .from("products")
        .insert({
          tenant_id: tenantId,
          name: np.name,
          status: "draft",
          sort_order: currentSort,
        })
        .select("id")
        .single();

      if (prodError || !newProduct) {
        throw new Error(prodError?.message ?? "Falha ao criar produto");
      }

      if (orphanMapping) {
        const { error: updateError } = await admin
          .from("gateway_product_mappings")
          .update({ product_id: newProduct.id, external_product_name: np.name })
          .eq("integration_id", integration.id)
          .eq("external_product_id", np.external_id);

        if (updateError) {
          await admin.from("products").delete().eq("id", newProduct.id);
          throw new Error(updateError.message);
        }
      } else {
        const { error: mapError } = await admin
          .from("gateway_product_mappings")
          .insert({
            tenant_id: tenantId,
            integration_id: integration.id,
            provider: integration.provider,
            external_product_id: np.external_id,
            product_id: newProduct.id,
            external_product_name: np.name,
          });

        if (mapError) {
          await admin.from("products").delete().eq("id", newProduct.id);
          throw new Error(mapError.message);
        }
      }

      createdCount++;
    } catch (itemErr) {
      errorCount++;
      errors.push({
        external_id: np.external_id,
        name: np.name,
        message: itemErr instanceof Error ? itemErr.message : String(itemErr),
      });
    }

    processedItems++;
  }

  const finalStatus = errorCount === toImport.length ? "failed" : "completed";

  const { data: finalJob } = await admin
    .from("gateway_sync_jobs")
    .update({
      status: finalStatus,
      processed_items: processedItems,
      created_count: createdCount,
      updated_count: 0,
      skipped_count: skippedCount,
      error_count: errorCount,
      errors,
      completed_at: new Date().toISOString(),
    })
    .eq("id", job.id)
    .select()
    .single();

  return json({ job: finalJob });
}

/* ══════════════════════════════════════════════════════════════
 * ORDERS (sync de vendas — novo)
 * ══════════════════════════════════════════════════════════════ */

async function handleOrders(
  admin: ReturnType<typeof createClient>,
  userId: string,
  tenantId: string,
  integration: { id: string; provider: string },
  creds: Record<string, string>,
  action: string,
): Promise<Response> {
  const salesAdapter = getSalesSyncAdapter(integration.provider);
  if (!salesAdapter) {
    return json({ error: `Sales sync not available for ${integration.provider}`, code: "integration_not_found" }, 400);
  }

  // Date range: últimos 90 dias
  const now = Date.now();
  const ninetyDaysMs = 90 * 24 * 60 * 60 * 1000;
  const dateRange = { startMs: now - ninetyDaysMs, endMs: now };

  // Buscar product mappings (external_product_id → product_id)
  const { data: mappingsData } = await admin
    .from("gateway_product_mappings")
    .select("external_product_id, product_id")
    .eq("integration_id", integration.id);

  const productMappings = new Map<string, string | null>();
  for (const m of mappingsData ?? []) {
    productMappings.set(m.external_product_id, m.product_id);
  }

  // Buscar gateway_external_ids de orders existentes (para marcar already_imported)
  const { data: existingOrders } = await admin
    .from("orders")
    .select("gateway_external_id")
    .eq("tenant_id", tenantId)
    .eq("gateway_provider", integration.provider)
    .not("gateway_external_id", "is", null);

  const existingOrderIds = new Set<string>(
    (existingOrders ?? []).map((o) => o.gateway_external_id).filter(Boolean),
  );

  // Fetch from gateway API
  let allSales: NormalizedGatewaySale[];
  let totalFetched: number;
  try {
    const raw = await salesAdapter.fetchAndNormalize(creds, dateRange, existingOrderIds, productMappings);
    totalFetched = raw.length;
    // Enforce cap para evitar timeout em tenants grandes
    allSales = raw.length > MAX_SALES_CAP ? raw.slice(0, MAX_SALES_CAP) : raw;
  } catch (err) {
    console.error("gateway-sync sales fetch error:", err);
    const msg = err instanceof Error ? err.message : String(err);
    return json({ error: msg, code: "connect_failed" }, 500);
  }

  /* ── FETCH: retornar resumo ── */
  if (action === "fetch") {
    const summary = computeSalesSummary(allSales, totalFetched);
    return json({ summary });
  }

  /* ── IMPORT ── */

  // Filtrar elegíveis: status importável + produto mapeado + não importado
  const eligible = allSales.filter(
    (s) =>
      IMPORTABLE_STATUSES.includes(s.status) &&
      s.product_mapped &&
      !s.already_imported &&
      s.buyer.email,
  );

  if (eligible.length === 0) {
    return json({ error: "No eligible sales to import", code: "import_failed" }, 400);
  }

  // Criar job
  const { data: job, error: jobError } = await admin
    .from("gateway_sync_jobs")
    .insert({
      tenant_id: tenantId,
      integration_id: integration.id,
      provider: integration.provider,
      resource_type: "orders",
      status: "running",
      total_items: eligible.length,
      started_by: userId,
    })
    .select()
    .single();

  if (jobError) {
    if (jobError.code === "23505") {
      return json({ error: "A sales import is already running", code: "rate_limited" }, 409);
    }
    console.error("gateway-sync: failed to create sales job:", jobError);
    return json({ error: "Failed to create job", code: "internal_error" }, 500);
  }

  // Processar vendas
  let createdCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;
  let processedItems = 0;
  let customersCreated = 0;
  let customersUpdated = 0;
  const errors: Array<{ external_id: string; name: string; message: string }> = [];

  // Batch: pré-carregar customers existentes por email para detectar creates vs updates
  const uniqueEmails = [...new Set(eligible.map((s) => s.buyer.email))];
  const { data: existingCustomers } = await admin
    .from("customers")
    .select("id, email")
    .eq("tenant_id", tenantId)
    .in("email", uniqueEmails);

  const existingCustomerEmails = new Set(
    (existingCustomers ?? []).map((c) => c.email),
  );

  for (const sale of eligible) {
    try {
      const wasExisting = existingCustomerEmails.has(sale.buyer.email);

      // 1. Find-or-create customer (reusar customer-manager.ts)
      const customerId = await findOrCreateCustomer(admin, tenantId, {
        email: sale.buyer.email,
        name: sale.buyer.name,
        phone: sale.buyer.phone,
        document: sale.buyer.document,
        documentType: sale.buyer.documentType,
        address: sale.buyer.address,
      });

      if (!customerId) {
        throw new Error("Falha ao criar/encontrar customer");
      }

      if (wasExisting) {
        customersUpdated++;
      } else {
        customersCreated++;
        existingCustomerEmails.add(sale.buyer.email);
      }

      // 2. Insert order
      const orderInsert: Record<string, unknown> = {
        tenant_id: tenantId,
        customer_id: customerId,
        product_id: sale.hubfy_product_id,
        status: sale.status,
        unit_amount: sale.amount_cents,
        currency: sale.currency,
        payment_method: sale.payment_method,
        gateway_external_id: sale.external_order_id,
        gateway_provider: integration.provider,
        integration_id: integration.id,
        gateway_order_created_at: sale.order_date,
        source: "external_gateway",
      };

      if (sale.is_subscription) {
        orderInsert.type = "subscription";
        if (ACTIVE_REVENUE_STATUSES.includes(sale.status)) {
          orderInsert.subscription_status = "active";
        } else {
          orderInsert.subscription_status = "cancelled";
        }
      }

      const { data: order, error: orderErr } = await admin
        .from("orders")
        .insert(orderInsert)
        .select("id")
        .single();

      if (orderErr || !order) {
        // Idempotência: unique index rejeita duplicata
        if (orderErr?.message?.includes("duplicate key") || orderErr?.message?.includes("unique")) {
          updatedCount++;
          processedItems++;
          continue;
        }
        throw new Error(orderErr?.message ?? "Falha ao criar order");
      }

      // 3. Incrementar revenue se status ativo
      if (ACTIVE_REVENUE_STATUSES.includes(sale.status) && sale.amount_cents > 0) {
        admin
          .rpc("increment_customer_revenue", {
            p_customer_id: customerId,
            p_amount: sale.amount_cents,
          })
          .then(() => {})
          .catch((err: unknown) => console.warn("increment_revenue error:", err));
      }

      createdCount++;
    } catch (itemErr) {
      errorCount++;
      errors.push({
        external_id: sale.external_order_id,
        name: sale.product_name,
        message: itemErr instanceof Error ? itemErr.message : String(itemErr),
      });
    }

    processedItems++;
  }

  // Finalizar job
  const finalStatus = errorCount === eligible.length ? "failed" : "completed";

  const { data: finalJob } = await admin
    .from("gateway_sync_jobs")
    .update({
      status: finalStatus,
      processed_items: processedItems,
      created_count: createdCount,
      updated_count: updatedCount,
      skipped_count: skippedCount,
      error_count: errorCount,
      errors,
      params: {
        customers_created: customersCreated,
        customers_updated: customersUpdated,
      },
      completed_at: new Date().toISOString(),
    })
    .eq("id", job.id)
    .select()
    .single();

  return json({ job: finalJob });
}

/* ── Helper: computar resumo de vendas ── */

function computeSalesSummary(sales: NormalizedGatewaySale[], totalFetched: number): SalesSyncSummary {
  let alreadyImported = 0;
  let unmappedProduct = 0;
  let skippedStatus = 0;
  let skippedNoEmail = 0;
  let eligible = 0;
  const unmappedMap = new Map<string, { name: string; count: number }>();
  const uniqueEmails = new Set<string>();
  const capped = totalFetched > MAX_SALES_CAP;

  for (const s of sales) {
    if (s.already_imported) {
      alreadyImported++;
      continue;
    }

    if (!IMPORTABLE_STATUSES.includes(s.status)) {
      skippedStatus++;
      continue;
    }

    if (!s.product_mapped) {
      unmappedProduct++;
      const existing = unmappedMap.get(s.external_product_id);
      if (existing) {
        existing.count++;
      } else {
        unmappedMap.set(s.external_product_id, { name: s.product_name, count: 1 });
      }
      continue;
    }

    if (!s.buyer.email) {
      skippedNoEmail++;
      continue;
    }

    eligible++;
    uniqueEmails.add(s.buyer.email);
  }

  const unmapped_products = Array.from(unmappedMap.entries()).map(
    ([external_id, { name, count }]) => ({ external_id, name, count }),
  );

  return {
    total: sales.length,
    total_fetched: totalFetched,
    eligible,
    already_imported: alreadyImported,
    unmapped_product: unmappedProduct,
    skipped_status: skippedStatus,
    skipped_no_email: skippedNoEmail,
    unique_customers: uniqueEmails.size,
    unmapped_products,
    capped,
  };
}
