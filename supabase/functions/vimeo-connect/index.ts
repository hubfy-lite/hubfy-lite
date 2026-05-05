/**
 * vimeo-connect
 *
 * Validates a Vimeo Personal Access Token, creates/updates the tenant integration,
 * and stores the token securely.
 *
 * POST { access_token: string }
 * Auth: tenant editor
 *
 * Returns: { integration: { id, provider, account_name, account_url, avatar_url, status } }
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
    const auth = await authorizeWorkspace(identity, tenantId, supabaseAdmin, { minRole: "editor" });

    // Validate token with Vimeo API
    const vimeoRes = await fetch("https://api.vimeo.com/me", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/vnd.vimeo.*+json;version=3.4",
      },
    });

    if (!vimeoRes.ok) {
      const status = vimeoRes.status;
      const body = await vimeoRes.text().catch(() => "");
      console.error("Vimeo API error:", { status, body });
      if (status === 401) {
        return jsonResponse({ error: "Invalid or expired Vimeo token", code: "vimeo_api_error" }, 401);
      }
      return jsonResponse({ error: `Vimeo API error: ${status}`, code: "vimeo_api_error" }, 502);
    }

    const vimeoUser = await vimeoRes.json();

    // Extract account data
    const accountName = vimeoUser.name || null;
    const accountUrl = vimeoUser.link || null;
    const accountExternalId = vimeoUser.uri?.replace("/users/", "") || null;
    const avatarUrl = vimeoUser.pictures?.sizes?.[2]?.link || vimeoUser.pictures?.base_link || null;
    const accountPlan = vimeoUser.account || null;

    // Build masked hint for the token
    const tokenHint = accessToken.length > 4
      ? "••••" + accessToken.slice(-4)
      : "••••";

    // Atomic upsert: integration + secret in one transaction
    const { data: integration, error: connectError } = await supabaseAdmin
      .rpc("connect_integration", {
        p_tenant_id: tenantId,
        p_provider: "vimeo",
        p_metadata: {
          account_name: accountName,
          account_url: accountUrl,
          avatar_url: avatarUrl,
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

    return jsonResponse({
      integration: {
        ...integration,
        account_plan: accountPlan,
      },
    });
  } catch (error) {
    console.error("vimeo-connect error:", error);
    return toErrorResponse(error, corsHeaders);
  }
});
