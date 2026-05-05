/**
 * gumlet-video-token
 *
 * Gera uma URL assinada (Signed URL) para o player Gumlet.
 * Verifica se o usuário tem acesso à aula antes de gerar o token.
 *
 * POST { lesson_id: string }
 * Auth: usuário autenticado e matriculado no curso
 *
 * Retorna: { embed_url: string, expires: number }
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  authenticateRequest,
  toErrorResponse,
} from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/**
 * Gera a assinatura HMAC-SHA1 para o embed URL do Gumlet.
 *
 * Formato Gumlet para embed URLs:
 *   String to sign: "/embed/{assetId}" + String(expires)
 *   Key: signed_url_secret (hex string → decoded to bytes)
 *   Algorithm: HMAC-SHA1
 *   Result: hex string
 *
 * URL final: https://play.gumlet.io/embed/{assetId}?token={sig}&expires={ts}&...params
 */
async function generateGumletSignedEmbedUrl(
  gumletAssetId: string,
  signedUrlSecret: string,
  videoSettingsParams: URLSearchParams,
  tokenTtlSeconds: number,
): Promise<{ embedUrl: string; expires: number }> {
  const expires = Math.round(Date.now() / 1000) + tokenTtlSeconds;

  // String to sign: path do embed + expiration (sem separador)
  const stringToSign = `/embed/${gumletAssetId}${expires}`;

  // Decodificar o secret de hex para bytes
  // (o Gumlet retorna o secret como hex string: "87a2e2fbb2...")
  let secretBytes: Uint8Array;
  try {
    const hexMatches = signedUrlSecret.match(/.{1,2}/g) ?? [];
    secretBytes = new Uint8Array(hexMatches.map((b) => parseInt(b, 16)));
  } catch {
    // Fallback: usar como UTF-8 se não for hex válido
    secretBytes = new TextEncoder().encode(signedUrlSecret);
  }

  // Importar chave para HMAC
  const key = await crypto.subtle.importKey(
    "raw",
    secretBytes,
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"],
  );

  // Gerar assinatura
  const dataBytes = new TextEncoder().encode(stringToSign);
  const signatureBuffer = await crypto.subtle.sign("HMAC", key, dataBytes);
  const signature = Array.from(new Uint8Array(signatureBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  // Montar URL final
  const params = new URLSearchParams(videoSettingsParams);
  params.set("token", signature);
  params.set("expires", String(expires));

  const embedUrl = `https://play.gumlet.io/embed/${gumletAssetId}?${params.toString()}`;

  return { embedUrl, expires };
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
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Authenticate (JWT-only — rejects API Keys early)
    const identity = await authenticateRequest(req, supabaseAdmin);

    if (identity.method === "api_key") {
      return jsonResponse({ error: "API keys are not accepted on this endpoint", code: "api_keys_not_accepted" }, 401);
    }

    // Build userClient for RPC calls that depend on auth.uid()
    const authHeader = req.headers.get("Authorization")!;
    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Validar body
    const body = await req.json();
    const lessonId = typeof body?.lesson_id === "string" ? body.lesson_id : null;
    if (!lessonId) {
      return jsonResponse({ error: "lesson_id is required", code: "missing_required_field" }, 400);
    }

    // Buscar dados da aula + tenant + video + proteção
    // Caminho correto: lessons → modules → courses → tenants → tenant_settings
    // (igual ao frontend: useCourseByTenantAndSlug usa tenants!inner → tenant_settings)
    const { data: lessonData, error: lessonError } = await supabaseAdmin
      .from("lessons")
      .select(`
        id,
        module_id,
        is_active,
        lesson_videos(provider_asset_id, status),
        modules!inner(
          course_id,
          courses!inner(
            id,
            tenant_id,
            is_active,
            tenants!inner(
              id,
              tenant_settings(
                plan,
                video_protection_enabled,
                gumlet_signed_url_secret,
                video_settings,
                icon_color,
                primary_color
              )
            )
          )
        )
      `)
      .eq("id", lessonId)
      .eq("is_active", true)
      .maybeSingle();

    if (lessonError) {
      console.error("Erro ao buscar aula:", lessonError);
      return jsonResponse({ error: "Failed to load lesson", code: "internal_error" }, 500);
    }

    if (!lessonData) {
      return jsonResponse({ error: "Lesson not found", code: "lesson_not_found" }, 404);
    }

    // Extrair dados aninhados
    const modules = lessonData.modules as {
      course_id: string;
      courses: {
        id: string;
        tenant_id: string;
        is_active: boolean;
        tenants: {
          id: string;
          tenant_settings: {
            plan: string;
            video_protection_enabled: boolean;
            gumlet_signed_url_secret: string | null;
            video_settings: unknown;
            icon_color: string | null;
            primary_color: string | null;
          } | null;
        };
      };
    };

    const course = modules?.courses;
    const tenantSettings = course?.tenants?.tenant_settings;
    // lesson_videos has UNIQUE on lesson_id → PostgREST returns object, not array
    const lessonVideo = lessonData.lesson_videos as
      | { provider_asset_id: string; status: string }
      | null;

    if (!course?.is_active) {
      return jsonResponse({ error: "Course unavailable", code: "course_unavailable" }, 403);
    }

    const gumletAssetId = lessonVideo?.provider_asset_id ?? null;
    const videoStatus = lessonVideo?.status ?? null;

    if (!gumletAssetId || videoStatus !== "ready") {
      return jsonResponse({ error: "Video not available", code: "video_not_available" }, 404);
    }

    // Verificar se o usuário tem acesso ao curso
    // Caso 1: matriculado (course_customers ou vitrine pública)
    // Caso 2: editor/owner do tenant (pode ver todas as aulas do seu próprio tenant)
    const { data: isEnrolled, error: enrollError } = await supabaseUser.rpc(
      "is_enrolled_in_course",
      { _course_id: course.id },
    );

    if (enrollError) {
      console.error("Erro ao verificar matrícula:", enrollError);
      return jsonResponse({ error: "Failed to verify access", code: "permission_check_failed" }, 500);
    }

    if (!isEnrolled) {
      const { data: isTenantEditor, error: editorError } = await supabaseUser.rpc(
        "is_tenant_editor",
        { _tenant_id: course.tenant_id },
      );

      if (editorError) {
        console.error("Erro ao verificar editor:", editorError);
        return jsonResponse({ error: "Failed to verify access", code: "permission_check_failed" }, 500);
      }

      if (!isTenantEditor) {
        return jsonResponse({ error: "Access denied — not enrolled in this course", code: "access_denied_no_enrollment" }, 403);
      }
    }

    // Construir parâmetros do player (video_settings do tenant)
    const videoSettings = tenantSettings?.video_settings;
    const fallbackColor = tenantSettings?.icon_color ?? tenantSettings?.primary_color;
    const isPro = ["pro", "business"].includes(tenantSettings?.plan ?? "free");
    const playerParams = buildPlayerParams(videoSettings, fallbackColor, isPro);

    // Se proteção não está ativa: retornar URL normal (sem token)
    if (!tenantSettings?.video_protection_enabled || !tenantSettings?.gumlet_signed_url_secret) {
      const baseUrl = `https://play.gumlet.io/embed/${gumletAssetId}`;
      const embedUrl = playerParams.toString()
        ? `${baseUrl}?${playerParams.toString()}`
        : baseUrl;

      return jsonResponse({ embed_url: embedUrl, signed: false });
    }

    // Proteção ativa: gerar URL assinada (4 horas de validade)
    const TOKEN_TTL_SECONDS = 4 * 60 * 60; // 4h

    const { embedUrl, expires } = await generateGumletSignedEmbedUrl(
      gumletAssetId,
      tenantSettings.gumlet_signed_url_secret,
      playerParams,
      TOKEN_TTL_SECONDS,
    );

    return jsonResponse({
      embed_url: embedUrl,
      expires,
      signed: true,
    });
  } catch (error) {
    console.error("gumlet-video-token error:", error);
    return toErrorResponse(error, corsHeaders);
  }
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function readBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function normalizeHexColor(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(trimmed)) return null;
  return trimmed.toLowerCase();
}

function buildPlayerParams(
  videoSettings: unknown,
  fallbackColor?: string | null,
  captionsEnabled?: boolean,
): URLSearchParams {
  const raw =
    videoSettings && typeof videoSettings === "object"
      ? (videoSettings as Record<string, unknown>)
      : {};
  const rawPlayer =
    raw.player && typeof raw.player === "object"
      ? (raw.player as Record<string, unknown>)
      : {};

  const params = new URLSearchParams();

  if (readBoolean(rawPlayer.preload, true)) params.set("preload", "true");
  if (readBoolean(rawPlayer.autoplay, false)) params.set("autoplay", "true");
  if (readBoolean(rawPlayer.loop, false)) params.set("loop", "true");
  if (readBoolean(rawPlayer.cast_enabled, true)) params.set("cast", "true");
  // Captions gated by plan: only include when captionsEnabled (Pro/Business)
  if (captionsEnabled && readBoolean(rawPlayer.captions_auto, false)) {
    params.set("caption_enabled", "true");
  }
  if (!readBoolean(rawPlayer.seek_enabled, true)) params.set("disable_seek", "true");
  if (!readBoolean(rawPlayer.controls_visible, true)) {
    params.set("disable_player_controls", "true");
  }

  const playerColor =
    normalizeHexColor(rawPlayer.player_color) ??
    normalizeHexColor(fallbackColor) ??
    "#6366f1";

  params.set("player_color", playerColor);
  params.set("show_video_title", "false");
  // Enable postMessage API for progress tracking (timeupdate, pause, ended events)
  params.set("api", "true");
  params.set("powered_by_gumlet_overlay", "false");

  return params;
}
