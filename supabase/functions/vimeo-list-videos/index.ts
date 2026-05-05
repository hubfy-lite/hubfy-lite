/**
 * vimeo-list-videos
 *
 * Lists videos from the tenant's connected Vimeo account.
 * Supports search and pagination.
 *
 * POST { page?: number, per_page?: number, query?: string }
 * Auth: tenant editor
 *
 * Returns: { videos: VimeoVideoItem[], page, per_page, total }
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

interface VimeoVideoItem {
  id: string;
  title: string;
  thumbnail_url: string | null;
  duration_seconds: number;
  source_url: string;
  playback_url: string;
  status: string;
  privacy_view: string;
  privacy_embed: string;
  project_name: string | null;
  can_select: boolean;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Auth
    const identity = await authenticateRequest(req, supabaseAdmin);

    // Parse request params
    const body = await req.json().catch(() => ({}));
    const tenantId = typeof body?.tenant_id === "string" ? body.tenant_id.trim() : null;

    if (!tenantId) {
      return jsonResponse({ error: "tenant_id é obrigatório" }, 400);
    }

    // Validate user is editor of this tenant
    const auth = await authorizeWorkspace(identity, tenantId, supabaseAdmin, { minRole: "editor" });

    // Get Vimeo integration + secret
    const { data: integration } = await supabaseAdmin
      .from("tenant_integrations")
      .select("id, status")
      .eq("tenant_id", tenantId)
      .eq("provider", "vimeo")
      .eq("status", "active")
      .maybeSingle();

    if (!integration) {
      return jsonResponse({ error: "Integração Vimeo não encontrada", code: "integration_not_found" }, 404);
    }

    const { data: secret } = await supabaseAdmin
      .from("tenant_integration_secrets")
      .select("credentials")
      .eq("integration_id", integration.id)
      .single();

    const vimeoToken = (secret?.credentials as Record<string, string>)?.access_token;
    if (!vimeoToken) {
      return jsonResponse({ error: "Token Vimeo não encontrado", code: "missing_vimeo_token" }, 500);
    }

    const page = Math.max(1, Number(body.page) || 1);
    const perPage = Math.min(100, Math.max(1, Number(body.per_page) || 20));
    const query = typeof body.query === "string" ? body.query.trim() : "";

    // Build Vimeo API URL
    const vimeoFields = [
      "uri", "name", "link", "duration", "status",
      "pictures.base_link", "pictures.sizes",
      "privacy.view", "privacy.embed",
      "player_embed_url",
    ].join(",");

    const vimeoParams = new URLSearchParams({
      fields: vimeoFields,
      sort: "date",
      direction: "desc",
      page: String(page),
      per_page: String(perPage),
    });

    if (query) {
      vimeoParams.set("query", query);
    }

    const vimeoRes = await fetch(
      `https://api.vimeo.com/me/videos?${vimeoParams.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${vimeoToken}`,
          Accept: "application/vnd.vimeo.*+json;version=3.4",
        },
      },
    );

    if (!vimeoRes.ok) {
      const status = vimeoRes.status;
      const body = await vimeoRes.text().catch(() => "");
      console.error("Vimeo API error:", { status, body });
      if (status === 401) {
        // Token revoked — update integration status
        const lastError = "Token revogado ou expirado pela API Vimeo";
        await supabaseAdmin
          .from("tenant_integrations")
          .update({ status: "error", last_error: lastError })
          .eq("id", integration.id);
        return jsonResponse({ error: "Token Vimeo revogado. Reconecte sua conta.", code: "vimeo_api_error" }, 401);
      }
      // Persist error for visibility
      await supabaseAdmin
        .from("tenant_integrations")
        .update({ last_error: `Vimeo API ${status}: ${body.slice(0, 200)}` })
        .eq("id", integration.id);
      return jsonResponse({ error: `Erro na API Vimeo: ${status}`, code: "vimeo_api_error" }, 502);
    }

    const vimeoData = await vimeoRes.json();

    // Transform Vimeo response
    const videos: VimeoVideoItem[] = (vimeoData.data || []).map((v: any) => {
      const videoId = v.uri?.replace("/videos/", "") || "";
      const privacyEmbed = v.privacy?.embed || "public";
      const privacyView = v.privacy?.view || "anybody";
      const isAvailable = v.status === "available";
      const canEmbed = privacyEmbed !== "private";

      // Get best thumbnail
      const thumbnailUrl =
        v.pictures?.sizes?.find((s: any) => s.width >= 640)?.link ||
        v.pictures?.sizes?.find((s: any) => s.width >= 295)?.link ||
        v.pictures?.base_link ||
        null;

      // Get project/folder name from parent_folder connection
      const projectName = v.metadata?.connections?.parent_folder?.name || null;

      return {
        id: videoId,
        title: v.name || "",
        thumbnail_url: thumbnailUrl,
        duration_seconds: v.duration || 0,
        source_url: v.link || `https://vimeo.com/${videoId}`,
        playback_url: `https://player.vimeo.com/video/${videoId}`,
        status: v.status || "unknown",
        privacy_view: privacyView,
        privacy_embed: privacyEmbed,
        project_name: projectName,
        can_select: isAvailable && canEmbed,
      };
    });

    return jsonResponse({
      videos,
      page: vimeoData.page || page,
      per_page: vimeoData.per_page || perPage,
      total: vimeoData.total || 0,
    });
  } catch (error) {
    console.error("vimeo-list-videos error:", error);
    return toErrorResponse(error, corsHeaders);
  }
});
