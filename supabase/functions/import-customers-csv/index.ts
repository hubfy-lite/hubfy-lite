import { createClient } from "jsr:@supabase/supabase-js@2";
import { authenticateRequest, authorizeWorkspace, toErrorResponse } from "../_shared/auth.ts";

/* ─── Constants ─── */

const MAX_ROWS = 2000;
const VALID_DOCUMENT_TYPES = ["CPF", "CNPJ", "PASSPORT", "DNI", "ID", "RUT", "EIN", "VAT"];

/* ─── Types ─── */

interface ImportRow {
  email: string;
  name: string;
  product_ids?: string;
  first_name?: string;
  last_name?: string;
  phone_country_code?: string;
  phone?: string;
  city?: string;
  state?: string;
  country?: string;
  document_type?: string;
  document?: string;
  external_id?: string;
}

type ImportType = "customers" | "contacts";

interface ImportRequest {
  rows: ImportRow[];
  filename?: string;
  tenant_id: string;
  import_type?: ImportType;
}

interface RowResult {
  line: number;
  email: string;
  status: "created" | "updated" | "skipped" | "error";
  customer_action: string;
  orders_created: string[];
  orders_skipped: string[];
  warnings: string[];
  errors: string[];
}

/* ─── Helpers ─── */

function corsHeaders(req: Request) {
  const origin = req.headers.get("origin") || "";
  return {
    "Access-Control-Allow-Origin": origin,
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

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeEmail(raw: string): string {
  return (raw || "").trim().toLowerCase();
}

function parseProductTokens(raw: string | undefined): string[] {
  if (!raw || !raw.trim()) return [];
  return [
    ...new Set(
      raw
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
    ),
  ];
}

/* ─── Main ─── */

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders(req) });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed", code: "method_not_allowed" }, 405, req);
  }

  try {
    // 1. Auth
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const admin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const identity = await authenticateRequest(req, admin);

    // 2. Parse body
    const body: ImportRequest = await req.json();
    const { rows, filename, tenant_id: requestedTenantId } = body;
    // Distinguish "field absent" (legacy callers, permissive) from "field sent explicitly"
    const importTypeExplicit = "import_type" in body;
    const importType: ImportType = body.import_type === "contacts" ? "contacts" : "customers";

    if (!requestedTenantId) {
      return jsonResponse({ error: "tenant_id is required", code: "missing_required_field" }, 400, req);
    }

    // 3. Validate user is editor+ of the requested tenant
    const auth = await authorizeWorkspace(identity, requestedTenantId, admin, { minRole: "editor" });
    const tenantId = auth.tenantId;

    if (!Array.isArray(rows) || rows.length === 0) {
      return jsonResponse({ error: "No rows to import", code: "import_failed" }, 400, req);
    }
    if (rows.length > MAX_ROWS) {
      return jsonResponse(
        { error: `Maximum ${MAX_ROWS} rows per file`, code: "import_failed" },
        400,
        req,
      );
    }

    // 4. Load all tenant products + gateway mappings once
    const [prodRes, mapRes] = await Promise.all([
      admin
        .from("products")
        .select("id, public_id, name, status")
        .eq("tenant_id", tenantId),
      admin
        .from("gateway_product_mappings")
        .select("product_id, external_product_id, integration_id!inner(tenant_id)")
        .eq("integration_id.tenant_id", tenantId),
    ]);

    const products = prodRes.data ?? [];

    // Build lookup indices
    const byPublicId = new Map<string, (typeof products)[0]>();
    const byGatewayId = new Map<string, (typeof products)[0][]>();

    // Index from gateway_product_mappings (source of truth)
    const mappingsByProduct = new Map<string, Set<string>>();
    for (const m of mapRes.data ?? []) {
      const rec = m as { product_id: string; external_product_id: string };
      if (!mappingsByProduct.has(rec.product_id)) mappingsByProduct.set(rec.product_id, new Set());
      mappingsByProduct.get(rec.product_id)!.add(rec.external_product_id);
    }

    for (const p of products) {
      if (p.public_id) byPublicId.set(p.public_id, p);

      // Index from gateway_product_mappings
      const externalIds = mappingsByProduct.get(p.id) ?? new Set<string>();

      for (const gid of externalIds) {
        if (!byGatewayId.has(gid)) byGatewayId.set(gid, []);
        byGatewayId.get(gid)!.push(p);
      }
    }

    function resolveProduct(token: string): {
      product: (typeof products)[0] | null;
      error?: string;
    } {
      const byPub = byPublicId.get(token);
      if (byPub) return { product: byPub };

      const byGw = byGatewayId.get(token);
      if (byGw && byGw.length === 1) return { product: byGw[0] };
      if (byGw && byGw.length > 1) {
        return {
          product: null,
          error: `Token "${token}" é ambíguo (${byGw.length} produtos)`,
        };
      }

      return { product: null, error: `Produto "${token}" não encontrado` };
    }

    // 5. Validate, normalize, deduplicate — CPU only, zero DB queries
    const validRows: Array<{
      line: number;
      email: string;
      name: string;
      phone?: string;
      phone_country_code?: string;
      first_name?: string;
      last_name?: string;
      city?: string;
      state?: string;
      country?: string;
      document?: string;
      document_type?: string;
      external_id?: string;
      resolved_products: Array<{ product_id: string; product_public_id: string }>;
    }> = [];

    const errorResults: RowResult[] = [];
    const seenEmails = new Set<string>();

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const lineNum = i + 2; // +2 because line 1 is header

      // ── Validate email ──
      const email = normalizeEmail(row.email);
      if (!email || !EMAIL_RE.test(email)) {
        errorResults.push({
          line: lineNum,
          email: row.email || "",
          status: "error",
          customer_action: "error",
          orders_created: [],
          orders_skipped: [],
          warnings: [],
          errors: ["Email inválido ou ausente"],
        });
        continue;
      }

      // ── Deduplicate by email ──
      if (seenEmails.has(email)) {
        errorResults.push({
          line: lineNum,
          email,
          status: "error",
          customer_action: "error",
          orders_created: [],
          orders_skipped: [],
          warnings: [],
          errors: ["Email duplicado no CSV (já apareceu em linha anterior)"],
        });
        continue;
      }
      seenEmails.add(email);

      // ── Validate name ──
      const name = (row.name || "").trim();
      if (!name) {
        errorResults.push({
          line: lineNum,
          email,
          status: "error",
          customer_action: "error",
          orders_created: [],
          orders_skipped: [],
          warnings: [],
          errors: ["Nome é obrigatório"],
        });
        continue;
      }

      // ── Normalize fields silently ──
      const rawPhoneCCDigits = (row.phone_country_code || "").replace(/[^0-9]/g, "");
      const rawPhoneCC = rawPhoneCCDigits.length >= 1 && rawPhoneCCDigits.length <= 4 ? rawPhoneCCDigits : null;
      const rawPhone = (row.phone || "").replace(/[^0-9]/g, "") || null;
      const rawStateLetters = (row.state || "").replace(/[^A-Za-z]/g, "").toUpperCase();
      const normalizedState = rawStateLetters.length === 2 ? rawStateLetters : null;
      const rawDocTypeStr = (row.document_type || "").trim().toUpperCase();
      const documentType = rawDocTypeStr && VALID_DOCUMENT_TYPES.includes(rawDocTypeStr) ? rawDocTypeStr : null;
      const document = (row.document || "").replace(/[^A-Za-z0-9]/g, "").toUpperCase() || null;

      // ── Resolve products (mode-dependent) ──
      const resolvedProducts: Array<{
        product_id: string;
        product_public_id: string;
      }> = [];
      const productWarnings: string[] = [];
      const tokens = parseProductTokens(row.product_ids);

      if (importType === "contacts" && importTypeExplicit) {
        // Contacts mode: if any row has non-empty products, reject the entire request
        if (tokens.length > 0) {
          return jsonResponse(
            {
              error:
                "Você está na importação de contatos. A coluna product_ids não deve ser preenchida. Para conceder acesso a produtos, use a importação de customers.",
            },
            400,
            req,
          );
        }
        // No product resolution for contacts
      } else if (importType === "customers" && importTypeExplicit) {
        // Customers mode (explicit): resolve products, require at least 1
        for (const token of tokens) {
          const { product, error } = resolveProduct(token);
          if (product) {
            resolvedProducts.push({
              product_id: product.id,
              product_public_id: product.public_id,
            });
          } else if (error) {
            productWarnings.push(error);
          }
        }

        // Strict: no resolved products = error
        if (tokens.length === 0 || resolvedProducts.length === 0) {
          const errMsg =
            tokens.length === 0
              ? "Coluna product_ids vazia. Na importação de customers, pelo menos 1 produto é obrigatório."
              : "Nenhum produto resolvido. Verifique os IDs na coluna product_ids.";
          errorResults.push({
            line: lineNum,
            email,
            status: "error",
            customer_action: "error",
            orders_created: [],
            orders_skipped: [],
            warnings: productWarnings,
            errors: [errMsg],
          });
          continue;
        }
      } else {
        // Legacy callers (import_type absent): permissive, products optional
        for (const token of tokens) {
          const { product, error } = resolveProduct(token);
          if (product) {
            resolvedProducts.push({
              product_id: product.id,
              product_public_id: product.public_id,
            });
          } else if (error) {
            productWarnings.push(error);
          }
        }
        // No error if products empty — legacy behavior
      }

      // Build valid row for RPC
      validRows.push({
        line: lineNum,
        email,
        name,
        phone: rawPhone,
        phone_country_code: rawPhoneCC,
        first_name: (row.first_name || "").trim() || null,
        last_name: (row.last_name || "").trim() || null,
        city: (row.city || "").trim() || null,
        state: normalizedState,
        country: (row.country || "").trim() || null,
        document,
        document_type: documentType,
        external_id: (row.external_id || "").trim() || null,
        resolved_products: resolvedProducts,
      });

      // If there were product warnings, we need to track them.
      // The RPC will return warnings from customer upsert (divergences).
      // Product warnings are from the edge validation, so we'll merge them after.
      if (productWarnings.length > 0) {
        // Store product warnings keyed by line for later merge
        (validRows[validRows.length - 1] as Record<string, unknown>)._productWarnings =
          productWarnings;
      }
    }

    // 6. Call the orchestrator RPC
    if (validRows.length === 0) {
      // All rows had validation errors — create a failed batch
      const { data: emptyBatch, error: batchErr } = await admin
        .from("customer_import_batches")
        .insert({
          tenant_id: tenantId,
          imported_by: auth.userId,
          filename: filename || null,
          import_type: importType,
          status: "failed",
          total_rows: rows.length,
          error_count: errorResults.length,
          result: { summary: { total_rows: rows.length, error_count: errorResults.length }, rows: errorResults },
          completed_at: new Date().toISOString(),
        })
        .select("id")
        .single();

      if (batchErr) {
        console.error("Batch insert error:", batchErr);
        return jsonResponse(
          { error: `Falha ao criar registro de importação: ${batchErr.message}` },
          500,
          req,
        );
      }

      return jsonResponse(
        {
          success: true,
          batch_id: emptyBatch?.id || null,
          total_rows: rows.length,
          created_count: 0,
          updated_count: 0,
          skipped_count: 0,
          error_count: errorResults.length,
          orders_created_count: 0,
          rows: errorResults,
        },
        200,
        req,
      );
    }

    // Prepare rows for RPC (strip internal _productWarnings before sending)
    const rpcRows = validRows.map((r) => {
      const { ...row } = r;
      delete (row as Record<string, unknown>)._productWarnings;
      return row;
    });

    const { data: rpcResult, error: rpcError } = await admin.rpc(
      "run_customer_csv_import",
      {
        p_tenant_id: tenantId,
        p_imported_by: auth.userId,
        p_filename: filename || null,
        p_rows: rpcRows,
        p_import_type: importType,
      },
    );

    if (rpcError) {
      console.error("RPC error:", rpcError);
      return jsonResponse(
        { error: `Erro na importação: ${rpcError.message}` },
        500,
        req,
      );
    }

    const result = rpcResult as {
      batch_id: string;
      success: boolean;
      error?: string;
      total_rows: number;
      created_count: number;
      updated_count: number;
      skipped_count: number;
      error_count: number;
      orders_created_count: number;
      rows: RowResult[];
    };

    // RPC caught an internal exception — batch marked as failed
    if (result.success === false) {
      console.error("RPC internal failure:", result.error);
      return jsonResponse(
        {
          success: false,
          batch_id: result.batch_id,
          error: result.error || "Erro interno na importação",
          total_rows: rows.length,
          created_count: 0,
          updated_count: 0,
          skipped_count: 0,
          error_count: rows.length,
          orders_created_count: 0,
          rows: errorResults,
        },
        500,
        req,
      );
    }

    // 7. Merge product warnings from edge validation into RPC results
    const productWarningsByLine = new Map<number, string[]>();
    for (const vr of validRows) {
      const pw = (vr as Record<string, unknown>)._productWarnings as
        | string[]
        | undefined;
      if (pw && pw.length > 0) {
        productWarningsByLine.set(vr.line, pw);
      }
    }

    const rpcRows2 = (result.rows || []).map((r: RowResult) => {
      const pw = productWarningsByLine.get(r.line);
      if (pw) {
        return { ...r, warnings: [...(r.warnings || []), ...pw] };
      }
      return r;
    });

    // 8. Combine error rows (from validation) + RPC rows, sorted by line
    const allRows: RowResult[] = [...errorResults, ...rpcRows2].sort(
      (a, b) => a.line - b.line,
    );

    return jsonResponse(
      {
        success: result.success,
        batch_id: result.batch_id,
        total_rows: rows.length,
        created_count: result.created_count,
        updated_count: result.updated_count,
        skipped_count: result.skipped_count,
        error_count: result.error_count + errorResults.length,
        orders_created_count: result.orders_created_count,
        rows: allRows,
      },
      200,
      req,
    );
  } catch (err) {
    console.error("import-customers-csv error:", err);
    return toErrorResponse(err, corsHeaders(req));
  }
});
