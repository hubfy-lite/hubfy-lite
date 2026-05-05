/**
 * ai-provider-disconnect
 *
 * Removes an AI provider integration for the current tenant.
 *
 * POST { tenant_id, provider: "openai" | "anthropic" }
 * Auth: tenant editor
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

const VALID_PROVIDERS = ["openai", "anthropic"] as const;

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

    const identity = await authenticateRequest(req, supabaseAdmin);

    // Parse body
    const body = await req.json().catch(() => ({}));
    const tenantId =
      typeof body?.tenant_id === "string" ? body.tenant_id.trim() : null;
    const provider =
      typeof body?.provider === "string" ? body.provider.trim() : null;

    if (!tenantId) {
      return jsonResponse({ error: "tenant_id is required", code: "missing_required_field" }, 400);
    }
    if (
      !provider ||
      !VALID_PROVIDERS.includes(provider as (typeof VALID_PROVIDERS)[number])
    ) {
      return jsonResponse({ error: "Invalid provider", code: "missing_required_field" }, 400);
    }

    // Validate user is editor of this tenant
    await authorizeWorkspace(identity, tenantId, supabaseAdmin, { minRole: "editor" });

    // Delete integration (cascade deletes secret)
    const { error: deleteError } = await supabaseAdmin
      .from("tenant_integrations")
      .delete()
      .eq("tenant_id", tenantId)
      .eq("provider", provider);

    if (deleteError) {
      console.error("Failed to delete integration:", deleteError);
      return jsonResponse({ error: "Failed to remove integration", code: "integration_delete_failed" }, 500);
    }

    return jsonResponse({ success: true });
  } catch (error) {
    console.error("ai-provider-disconnect error:", error);
    return toErrorResponse(error, corsHeaders);
  }
});
