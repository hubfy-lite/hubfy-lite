/**
 * wistia-connect
 *
 * Validates a Wistia API token, creates/updates the tenant integration,
 * and stores the token securely.
 *
 * POST { access_token: string, tenant_id: string }
 * Auth: tenant editor
 *
 * Returns: { integration: { id, provider, account_name, account_url, status } }
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { authenticateRequest, authorizeWorkspace, toErrorResponse } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed", code: "method_not_allowed" }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Auth
    const identity = await authenticateRequest(req, supabaseAdmin);

    // Parse body
    const body = await req.json();
    const tenantId = typeof body?.tenant_id === "string" ? body.tenant_id.trim() : null;
    const accessToken = typeof body?.access_token === "string" ? body.access_token.trim() : null;

    if (!tenantId) {
      return jsonResponse({ error: "tenant_id is required", code: "missing_required_field" }, 400);
    }
    if (!accessToken) {
      return jsonResponse({ error: "access_token is required", code: "missing_required_field" }, 400);
    }

    // Validate user is editor of this tenant
    await authorizeWorkspace(identity, tenantId, supabaseAdmin, { minRole: "editor" });

    // Validate token with Wistia API
    const wistiaRes = await fetch("https://api.wistia.com/v1/account.json", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!wistiaRes.ok) {
      const status = wistiaRes.status;
      const text = await wistiaRes.text().catch(() => "");
      console.error("Wistia API error:", { status, body: text });
      if (status === 401) {
        return jsonResponse({ error: "Invalid or expired Wistia token", code: "wistia_api_error" }, 401);
      }
      return jsonResponse({ error: `Wistia API error: ${status}`, code: "wistia_api_error" }, 502);
    }

    const wistiaAccount = await wistiaRes.json();

    // Extract account data
    const accountName = wistiaAccount.name || null;
    const accountUrl = wistiaAccount.url || null;
    const accountExternalId = wistiaAccount.id ? String(wistiaAccount.id) : null;

    // Build masked hint for the token
    const tokenHint = accessToken.length > 4
      ? "••••" + accessToken.slice(-4)
      : "••••";

    // Atomic upsert: integration + secret
    const { data: integration, error: connectError } = await supabaseAdmin
      .rpc("connect_integration", {
        p_tenant_id: tenantId,
        p_provider: "wistia",
        p_metadata: {
          account_name: accountName,
          account_url: accountUrl,
          avatar_url: null,
          account_external_id: accountExternalId,
        },
        p_credentials: { access_token: accessToken },
        p_credentials_hint: { access_token: tokenHint },
      })
      .single();

    if (connectError || !integration) {
      console.error("Failed to connect integration:", JSON.stringify(connectError));
      return jsonResponse({
        error: "Falha ao salvar integração",
        code: "integration_save_failed",
        details: connectError?.message || connectError?.code || null,
      }, 500);
    }

    return jsonResponse({ integration });
  } catch (error) {
    console.error("wistia-connect error:", error);
    return toErrorResponse(error, corsHeaders);
  }
});
