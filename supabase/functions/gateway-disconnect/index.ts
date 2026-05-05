/**
 * Gateway Disconnect
 *
 * Desconecta um gateway de pagamento.
 * Lifecycle: status='inactive' + deleta secrets. Row preservada (FK integrity).
 * Mapeamentos de produtos NÃO são deletados (preservar se reconectar).
 *
 * Body: { provider: string, tenant_id: string }
 * Acesso: usuário autenticado, editor do tenant
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { authenticateRequest, authorizeWorkspace, toErrorResponse } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function respond(status: number, data: Record<string, unknown>): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, supabaseServiceKey);

    /* ── Auth ── */
    const identity = await authenticateRequest(req, admin);

    /* ── Parse body ── */
    let provider: string;
    let tenantId: string;
    try {
      const body = await req.json();
      provider = body.provider;
      tenantId = body.tenant_id;
    } catch {
      return respond(400, { error: "Invalid request body", code: "invalid_body" });
    }

    if (!provider) {
      return respond(400, { error: "provider is required", code: "missing_required_field" });
    }
    if (!tenantId) {
      return respond(400, { error: "tenant_id is required", code: "missing_required_field" });
    }

    /* ── Verificar permissão de editor ── */
    const auth = await authorizeWorkspace(identity, tenantId, admin, { minRole: "editor" });

    /* ── Buscar integração ── */
    const { data: integration, error: intError } = await admin
      .from("tenant_integrations")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("provider", provider)
      .maybeSingle();

    if (intError || !integration) {
      return respond(404, { error: "Integration not found", code: "integration_not_found" });
    }

    /* ── Soft delete: status='inactive' + deletar secrets ── */

    // 1. Deletar secrets (credenciais apagadas → webhooks futuros falham auth)
    await admin
      .from("tenant_integration_secrets")
      .delete()
      .eq("integration_id", integration.id);

    // 2. Inativar integração (row preservada para FK integrity)
    await admin
      .from("tenant_integrations")
      .update({
        status: "inactive",
        credentials_hint: null,
        last_error: "Desconectado pelo usuário",
        updated_at: new Date().toISOString(),
      })
      .eq("id", integration.id);

    return respond(200, {
      disconnected: true,
      provider,
    });
  } catch (err) {
    console.error("gateway-disconnect error:", err);
    return toErrorResponse(err, corsHeaders);
  }
});
