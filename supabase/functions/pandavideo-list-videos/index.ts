/**
 * pandavideo-list-videos
 *
 * Lists videos from the tenant's connected Panda Video account.
 * Supports search and pagination.
 *
 * POST { page?: number, per_page?: number, query?: string }
 * Auth: tenant editor
 *
 * Returns: { videos: VideoItem[], page, per_page, total }
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

interface VideoItem {
  id: string;
  title: string;
  thumbnail_url: string | null;
  duration_seconds: number;
  source_url: string;
  playback_url: string;
  status: string;
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
    await authorizeWorkspace(identity, tenantId, supabaseAdmin, { minRole: "editor" });

    // Get Panda Video integration + secret
    const { data: integration } = await supabaseAdmin
      .from("tenant_integrations")
      .select("id, status")
      .eq("tenant_id", tenantId)
      .eq("provider", "pandavideo")
      .eq("status", "active")
      .maybeSingle();

    if (!integration) {
      return jsonResponse({ error: "Integração Panda Video não encontrada", code: "integration_not_found" }, 404);
    }

    const { data: secret } = await supabaseAdmin
      .from("tenant_integration_secrets")
      .select("credentials")
      .eq("integration_id", integration.id)
      .single();

    const apiKey = (secret?.credentials as Record<string, string>)?.api_key;
    if (!apiKey) {
      return jsonResponse({ error: "API Key Panda Video não encontrada", code: "missing_pandavideo_key" }, 500);
    }

    const page = Math.max(1, Number(body.page) || 1);
    const perPage = Math.min(100, Math.max(1, Number(body.per_page) || 20));
    const query = typeof body.query === "string" ? body.query.trim() : "";

    // Build Panda Video API URL
    const params = new URLSearchParams({
      page: String(page),
      limit: String(perPage),
    });

    if (query) {
      params.set("title", query);
    }

    const pandaRes = await fetch(
      `https://api-v2.pandavideo.com.br/videos?${params.toString()}`,
      { headers: { Authorization: apiKey } },
    );

    if (!pandaRes.ok) {
      const status = pandaRes.status;
      const text = await pandaRes.text().catch(() => "");
      console.error("Panda Video API error:", { status, body: text });
      if (status === 401 || status === 403) {
        const lastError = "API Key revogada ou inválida";
        await supabaseAdmin
          .from("tenant_integrations")
          .update({ status: "error", last_error: lastError })
          .eq("id", integration.id);
        return jsonResponse({ error: "API Key Panda Video revogada. Reconecte sua conta.", code: "pandavideo_api_error" }, 401);
      }
      await supabaseAdmin
        .from("tenant_integrations")
        .update({ last_error: `Panda Video API ${status}: ${text.slice(0, 200)}` })
        .eq("id", integration.id);
      return jsonResponse({ error: `Erro na API Panda Video: ${status}`, code: "pandavideo_api_error" }, 502);
    }

    const pandaData = await pandaRes.json();

    // Panda Video returns { videos: [...], total: N } or an array directly
    const rawVideos = Array.isArray(pandaData) ? pandaData : (pandaData.videos || pandaData.data || []);
    const total = pandaData.total ?? rawVideos.length;

    // Transform response
    const videos: VideoItem[] = rawVideos.map((v: any) => {
      const isReady = v.status === "converted" || v.status === "ready" || v.status === "CONVERTED";

      return {
        id: v.id || "",
        title: v.title || "",
        thumbnail_url: v.thumbnail || null,
        duration_seconds: Math.round(v.length || v.duration || 0),
        source_url: v.video_player || "",
        playback_url: v.video_player || "",
        status: v.status || "unknown",
        can_select: isReady,
      };
    });

    return jsonResponse({ videos, page, per_page: perPage, total });
  } catch (error) {
    console.error("pandavideo-list-videos error:", error);
    return toErrorResponse(error, corsHeaders);
  }
});
