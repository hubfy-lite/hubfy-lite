import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { authenticateRequest, authorizeWorkspace, toErrorResponse } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
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

  try {
    // 1. Auth
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const identity = await authenticateRequest(req, supabaseAdmin);

    // 2. Parse body
    const { tenant_id, user_id } = await req.json();

    if (!tenant_id || typeof tenant_id !== "string") {
      return jsonResponse({ error: "tenant_id is required", code: "missing_required_field" }, 400);
    }
    if (!user_id || typeof user_id !== "string") {
      return jsonResponse({ error: "user_id is required", code: "missing_required_field" }, 400);
    }

    // 3. Validate caller is owner
    const auth = await authorizeWorkspace(identity, tenant_id, supabaseAdmin, { minRole: "owner" });

    // 4. Prevent self-removal
    if (auth.userId === user_id) {
      return jsonResponse({ error: "You cannot remove yourself", code: "cannot_remove_self" }, 400);
    }

    // 5. Delete team member
    const { error: deleteError } = await supabaseAdmin
      .from("tenant_users")
      .delete()
      .eq("tenant_id", tenant_id)
      .eq("user_id", user_id);

    if (deleteError) {
      // The ensure_tenant_has_owner trigger will catch last-owner removal
      if (deleteError.message?.includes("must have at least one owner")) {
        return jsonResponse(
          { error: "Cannot remove the last workspace owner", code: "cannot_remove_last_owner" },
          400
        );
      }
      throw deleteError;
    }

    return jsonResponse({ success: true });
  } catch (error) {
    console.error("remove-team-member error:", error);
    return toErrorResponse(error, corsHeaders);
  }
});
