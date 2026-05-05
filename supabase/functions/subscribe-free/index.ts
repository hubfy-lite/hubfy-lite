import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  authenticateRequest,
  authorizeWorkspace,
  toErrorResponse,
} from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const identity = await authenticateRequest(req, supabaseAdmin);

    let tenantId: string | null = null;
    try {
      const body = await req.json();
      tenantId = body?.tenant_id ?? null;
    } catch {
      tenantId = null;
    }

    if (!tenantId) {
      return new Response(JSON.stringify({ error: "tenant_id is required", code: "missing_required_field" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await authorizeWorkspace(identity, tenantId, supabaseAdmin, {
      minRole: "owner",
      jwtOnly: true,
    });

    // Ativa plano free diretamente no banco (sem gateway externo)
    const { error } = await supabaseAdmin
      .from("subscriptions")
      .upsert(
        {
          tenant_id: tenantId,
          status: "active",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "tenant_id" },
      );

    if (error) throw error;

    return new Response(
      JSON.stringify({ success: true }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("subscribe-free error:", error);
    return toErrorResponse(error, corsHeaders);
  }
});
