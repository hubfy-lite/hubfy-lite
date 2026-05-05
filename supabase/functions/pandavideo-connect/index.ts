/**
 * pandavideo-connect
 *
 * Validates a Panda Video API key, creates/updates the tenant integration,
 * and stores the key securely.
 *
 * POST { api_key: string, tenant_id: string }
 * Auth: tenant editor
 *
 * Returns: { integration: { id, provider, status, ... } }
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
    const apiKey = typeof body?.api_key === "string" ? body.api_key.trim() : null;

    if (!tenantId) {
      return jsonResponse({ error: "tenant_id is required", code: "missing_required_field" }, 400);
    }
    if (!apiKey) {
      return jsonResponse({ error: "api_key is required", code: "missing_required_field" }, 400);
    }

    // Validate user is editor of this tenant
    await authorizeWorkspace(identity, tenantId, supabaseAdmin, { minRole: "editor" });

    // Validate API key by listing videos (Panda Video has no /me endpoint)
    const pandaRes = await fetch("https://api-v2.pandavideo.com.br/videos?page=1&limit=1", {
      headers: { Authorization: apiKey },
    });

    if (!pandaRes.ok) {
      const status = pandaRes.status;
      const text = await pandaRes.text().catch(() => "");
      console.error("Panda Video API error:", { status, body: text });
      if (status === 401 || status === 403) {
        return jsonResponse({ error: "Invalid Panda Video API key", code: "pandavideo_api_error" }, 401);
      }
      return jsonResponse({ error: `Panda Video API error: ${status}`, code: "pandavideo_api_error" }, 502);
    }

    // Build masked hint for the key
    const keyHint = apiKey.length > 4
      ? "••••" + apiKey.slice(-4)
      : "••••";

    // Atomic upsert: integration + secret
    const { data: integration, error: connectError } = await supabaseAdmin
      .rpc("connect_integration", {
        p_tenant_id: tenantId,
        p_provider: "pandavideo",
        p_metadata: {
          account_name: null,
          account_url: null,
          avatar_url: null,
          account_external_id: null,
        },
        p_credentials: { api_key: apiKey },
        p_credentials_hint: { api_key: keyHint },
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
    console.error("pandavideo-connect error:", error);
    return toErrorResponse(error, corsHeaders);
  }
});
