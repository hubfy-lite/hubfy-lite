/**
 * wistia-list-videos
 *
 * Lists videos from the tenant's connected Wistia account.
 * Supports search and pagination.
 *
 * POST { page?: number, per_page?: number, query?: string }
 * Auth: tenant editor
 *
 * Returns: { videos: VideoItem[], page, per_page, total }
 *
 * Note: Wistia's list endpoint does not return a total count.
 * We use a heuristic: if returned items === per_page, there are likely more pages.
 * total is set to -1 to signal "unknown total".
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

    // Get Wistia integration + secret
    const { data: integration } = await supabaseAdmin
      .from("tenant_integrations")
      .select("id, status")
      .eq("tenant_id", tenantId)
      .eq("provider", "wistia")
      .eq("status", "active")
      .maybeSingle();

    if (!integration) {
      return jsonResponse({ error: "Integração Wistia não encontrada", code: "integration_not_found" }, 404);
    }

    const { data: secret } = await supabaseAdmin
      .from("tenant_integration_secrets")
      .select("credentials")
      .eq("integration_id", integration.id)
      .single();

    const accessToken = (secret?.credentials as Record<string, string>)?.access_token;
    if (!accessToken) {
      return jsonResponse({ error: "Token Wistia não encontrado", code: "missing_wistia_token" }, 500);
    }

    const page = Math.max(1, Number(body.page) || 1);
    const perPage = Math.min(100, Math.max(1, Number(body.per_page) || 20));
    const query = typeof body.query === "string" ? body.query.trim() : "";

    // Build Wistia API URL
    const params = new URLSearchParams({
      page: String(page),
      per_page: String(perPage),
      type: "Video",
    });

    if (query) {
      params.set("name", query);
    }

    const wistiaRes = await fetch(
      `https://api.wistia.com/v1/medias.json?${params.toString()}`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );

    if (!wistiaRes.ok) {
      const status = wistiaRes.status;
      const text = await wistiaRes.text().catch(() => "");
      console.error("Wistia API error:", { status, body: text });
      if (status === 401) {
        const lastError = "Token revogado ou expirado pela API Wistia";
        await supabaseAdmin
          .from("tenant_integrations")
          .update({ status: "error", last_error: lastError })
          .eq("id", integration.id);
        return jsonResponse({ error: "Token Wistia revogado. Reconecte sua conta.", code: "wistia_api_error" }, 401);
      }
      if (status === 429) {
        return jsonResponse({ error: "Rate limit da Wistia atingido. Tente novamente em breve.", code: "wistia_rate_limit" }, 429);
      }
      await supabaseAdmin
        .from("tenant_integrations")
        .update({ last_error: `Wistia API ${status}: ${text.slice(0, 200)}` })
        .eq("id", integration.id);
      return jsonResponse({ error: `Erro na API Wistia: ${status}`, code: "wistia_api_error" }, 502);
    }

    const wistiaData = await wistiaRes.json();

    // Wistia returns an array of media objects directly
    const rawMedias = Array.isArray(wistiaData) ? wistiaData : [];

    // Transform response — use hashed_id for embeds
    const videos: VideoItem[] = rawMedias.map((m: any) => {
      const hashedId = m.hashed_id || "";
      const isReady = m.status === "ready";

      return {
        id: hashedId,
        title: m.name || "",
        thumbnail_url: m.thumbnail?.url || null,
        duration_seconds: Math.round(m.duration || 0),
        source_url: `https://fast.wistia.com/medias/${hashedId}`,
        playback_url: `https://fast.wistia.net/embed/iframe/${hashedId}`,
        status: m.status || "unknown",
        can_select: isReady,
      };
    });

    // Wistia doesn't return total — use heuristic
    const hasMore = rawMedias.length === perPage;
    const total = hasMore ? -1 : ((page - 1) * perPage + rawMedias.length);

    return jsonResponse({ videos, page, per_page: perPage, total });
  } catch (error) {
    console.error("wistia-list-videos error:", error);
    return toErrorResponse(error, corsHeaders);
  }
});
