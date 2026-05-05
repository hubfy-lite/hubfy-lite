/**
 * gumlet-enable-video-protection
 *
 * Ativa ou desativa a proteção de vídeos via Signed URL do Gumlet
 * para um workspace (tenant). Requer plano pro ou superior.
 *
 * POST { tenant_id: string, enable: boolean }
 * Auth: owner ou editor do tenant
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { authenticateRequest, authorizeWorkspace, toErrorResponse } from "../_shared/auth.ts";
import { ensureGumletWorkspace, GUMLET_API_BASE } from "../_shared/gumlet.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/** Ativa ou desativa signed URL no workspace Gumlet */
async function setGumletWorkspaceSigning(
  apiKey: string,
  workspaceId: string,
  enable: boolean,
): Promise<{ ok: boolean; signed_url_secret?: string; body: unknown }> {
  const response = await fetch(
    `${GUMLET_API_BASE}/video/workspaces/${encodeURIComponent(workspaceId)}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        video_protection: {
          signed_url: enable,
        },
      }),
    },
  );

  const text = await response.text();
  let body: unknown = text;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }

  const typed = body as Record<string, unknown> | null;
  const videoProtection = typed?.video_protection as
    | { signed_url?: boolean; signed_url_secret?: string }
    | undefined;

  return {
    ok: response.ok,
    signed_url_secret: videoProtection?.signed_url_secret,
    body,
  };
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

    const identity = await authenticateRequest(req, supabaseAdmin);

    // Validar body
    const body = await req.json();
    const tenantId = typeof body?.tenant_id === "string" ? body.tenant_id : null;
    const enable = typeof body?.enable === "boolean" ? body.enable : null;

    if (!tenantId || enable === null) {
      return jsonResponse({ error: "tenant_id and enable are required", code: "missing_required_field" }, 400);
    }

    // Verificar que o usuário é owner ou editor do tenant
    await authorizeWorkspace(identity, tenantId, supabaseAdmin, { minRole: "editor" });

    // Buscar plano do tenant — apenas pro/business pode ativar
    const { data: settings, error: settingsError } = await supabaseAdmin
      .from("tenant_settings")
      .select("plan, gumlet_workspace_id")
      .eq("tenant_id", tenantId)
      .single();

    if (settingsError || !settings) {
      return jsonResponse({ error: "Tenant not found", code: "tenant_not_found" }, 404);
    }

    if (enable && !["pro", "business"].includes(settings.plan ?? "free")) {
      return jsonResponse(
        {
          error: "Protected videos require the Pro plan or higher",
          code: "upgrade_required",
        },
        403,
      );
    }

    // Obter (ou criar) workspace Gumlet
    const gumletApiKey = Deno.env.get("GUMLET_API_KEY");
    if (!gumletApiKey) {
      return jsonResponse({ error: "Gumlet API Key not configured", code: "gumlet_not_configured" }, 500);
    }

    const workspaceId = await ensureGumletWorkspace(
      supabaseAdmin,
      gumletApiKey,
      tenantId,
    );

    if (!workspaceId) {
      return jsonResponse({ error: "Failed to get Gumlet workspace", code: "gumlet_not_configured" }, 500);
    }

    // Chamar API Gumlet para ativar/desativar signed URLs
    const gumletResult = await setGumletWorkspaceSigning(
      gumletApiKey,
      workspaceId,
      enable,
    );

    if (!gumletResult.ok) {
      console.error("Gumlet video_protection update failed:", gumletResult.body);
      return jsonResponse(
        {
          error: "Failed to configure Gumlet protection",
          code: "gumlet_not_configured",
          details: gumletResult.body,
        },
        502,
      );
    }

    // Persistir no banco
    const updatePayload: Record<string, unknown> = {
      video_protection_enabled: enable,
    };

    if (enable) {
      // Quando ativa: salvar o secret retornado pelo Gumlet
      if (!gumletResult.signed_url_secret) {
        console.error("Gumlet não retornou signed_url_secret:", gumletResult.body);
        return jsonResponse(
          { error: "Gumlet did not return signed_url_secret", code: "gumlet_not_configured" },
          502,
        );
      }
      updatePayload.gumlet_signed_url_secret = gumletResult.signed_url_secret;
    } else {
      // Quando desativa: limpar o secret
      updatePayload.gumlet_signed_url_secret = null;
    }

    const { error: updateError } = await supabaseAdmin
      .from("tenant_settings")
      .update(updatePayload)
      .eq("tenant_id", tenantId);

    if (updateError) {
      console.error("Falha ao atualizar tenant_settings:", updateError);
      return jsonResponse({ error: "Failed to save configuration", code: "integration_save_failed" }, 500);
    }

    return jsonResponse({
      success: true,
      tenant_id: tenantId,
      video_protection_enabled: enable,
    });
  } catch (error) {
    console.error("gumlet-enable-video-protection error:", error);
    return toErrorResponse(error, corsHeaders);
  }
});
