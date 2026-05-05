import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { authenticateRequest, authorizeWorkspace, toErrorResponse } from "../_shared/auth.ts";
import {
  ensureGumletWorkspace,
  normalizeVideoSettings,
  toGumletPlayerConfig,
  updateGumletWorkspacePlayerConfig,
} from "../_shared/gumlet.ts";

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

    const body = await req.json();
    const tenantId = typeof body?.tenant_id === "string" ? body.tenant_id : null;

    if (!tenantId) {
      return jsonResponse({ error: "tenant_id is required", code: "missing_required_field" }, 400);
    }

    await authorizeWorkspace(identity, tenantId, supabaseAdmin, { minRole: "editor" });

    const gumletApiKey = Deno.env.get("GUMLET_API_KEY");
    if (!gumletApiKey) {
      return jsonResponse({ error: "Gumlet not configured", code: "gumlet_not_configured" }, 500);
    }

    // Single SELECT — fetch everything we need (workspace_id + settings + colors + pixels)
    const { data: settingsRow, error: settingsError } = await supabaseAdmin
      .from("tenant_settings")
      .select("plan, gumlet_workspace_id, video_settings, icon_color, primary_color, facebook_pixel_id, ga_tracking_id")
      .eq("tenant_id", tenantId)
      .single();

    if (settingsError) {
      console.error("Failed to fetch tenant_settings:", settingsError);
      return jsonResponse({ error: "Failed to load tenant settings", code: "internal_error" }, 500);
    }

    // Pass the workspace_id we already have, and skip the redundant
    // enforceNoGumletBranding POST — we're about to send a full player_config
    // update below that already includes powered_by_gumlet_overlay=false.
    const workspaceId = await ensureGumletWorkspace(
      supabaseAdmin,
      gumletApiKey,
      tenantId,
      {
        existingWorkspaceId: settingsRow?.gumlet_workspace_id,
        skipBrandingEnforcement: true,
      },
    );

    if (!workspaceId) {
      return jsonResponse({ error: "Failed to ensure Gumlet workspace", code: "gumlet_not_configured" }, 500);
    }

    const normalizedVideoSettings = normalizeVideoSettings(settingsRow?.video_settings);
    const fallbackColor =
      settingsRow?.icon_color ??
      settingsRow?.primary_color ??
      null;
    const isPro = ["pro", "business"].includes(settingsRow?.plan ?? "free");
    const playerConfig = toGumletPlayerConfig(normalizedVideoSettings, {
      fallbackColor,
      captionsEnabled: isPro,
    });

    // Include pixel_tags in player config (always sent to allow clearing)
    const pixelTags: Record<string, string> = {};
    if (settingsRow?.facebook_pixel_id) pixelTags.facebook_pixel = settingsRow.facebook_pixel_id;
    if (settingsRow?.ga_tracking_id) pixelTags.ga_tracking_id = settingsRow.ga_tracking_id;
    playerConfig.pixel_tags = pixelTags;

    const gumletUpdate = await updateGumletWorkspacePlayerConfig(
      gumletApiKey,
      workspaceId,
      playerConfig,
    );

    if (!gumletUpdate.ok) {
      console.error("Gumlet workspace update failed:", gumletUpdate.status, gumletUpdate.body);
      return jsonResponse(
        {
          error: "Failed to sync workspace settings with Gumlet",
          code: "gumlet_not_configured",
          details: gumletUpdate.body,
          status: gumletUpdate.status,
        },
        502,
      );
    }

    // Note: we don't re-write video_settings to the DB here. The frontend
    // already normalized and persisted it via updateTenant() before invoking
    // this function. Re-writing would be a redundant UPDATE round-trip.

    return jsonResponse({
      success: true,
      tenant_id: tenantId,
      workspace_id: workspaceId,
      applied_player_config: playerConfig,
    });
  } catch (error) {
    console.error("sync-video-settings error:", error);
    return toErrorResponse(error, corsHeaders);
  }
});
