import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  authenticateRequest,
  toErrorResponse,
} from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface SetupTenantRequest {
  tenantName?: string | null;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth (JWT-only — user-scoped, no workspace)
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const identity = await authenticateRequest(req, supabaseAdmin);

    // Reject API Keys explicitly (this endpoint is JWT-only)
    if (identity.method === "api_key") {
      return new Response(
        JSON.stringify({
          error: "API keys are not accepted on this endpoint",
          code: "api_keys_not_accepted",
        }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse request body (optional)
    let body: SetupTenantRequest = { tenantName: null };
    try {
      body = await req.json();
    } catch {
      // Body is optional
    }

    // Step 1: Check if user already has tenant role
    const { data: existingRole } = await supabaseAdmin
      .from("user_roles")
      .select("id, role")
      .eq("user_id", identity.userId)
      .eq("role", "tenant")
      .maybeSingle();

    if (!existingRole) {
      const { error: insertRoleError } = await supabaseAdmin
        .from("user_roles")
        .insert({ user_id: identity.userId, role: "tenant" });

      if (insertRoleError) {
        console.error("Error setting tenant role:", insertRoleError);
        return new Response(
          JSON.stringify({ error: "Failed to set tenant role", code: "internal_error" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Note: Tenant creation is handled by the /admin/new-workspace flow.
    // This function only ensures the tenant role.

    return new Response(
      JSON.stringify({
        success: true,
        message: "Tenant role set successfully. Create your workspace in the New Workspace screen.",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Unexpected error:", error);
    return toErrorResponse(error, corsHeaders);
  }
});
