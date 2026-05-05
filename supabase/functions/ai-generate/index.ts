/**
 * ai-generate
 *
 * Generates structured content (title, description, etc.) using OpenAI or the
 * tenant's own AI provider credentials.
 *
 * POST {
 *   tenant_id: string,
 *   feature: "course_basics",
 *   input: { user_input: string, current_title?: string },
 *   provider: "hubfy" | "openai",
 *   language: string  // pt-BR, en, es, fr, de, it
 * }
 *
 * Auth: tenant editor
 * Returns: feature-specific JSON (e.g. { title, description } for course_basics)
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { authenticateRequest, authorizeWorkspace, toErrorResponse } from "../_shared/auth.ts";
import {
  buildCourseBasicsPrompt,
  COURSE_BASICS_SCHEMA,
  type AIFeature,
  type CourseBasicsInput,
  type CourseBasicsOutput,
} from "./prompts.ts";

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

// ── Config ──────────────────────────────────────────────

const HUBFY_MODEL = "gpt-5.4-nano";
const USER_MODEL = "gpt-5.4-nano";
const MAX_USER_INPUT_CHARS = 2000;
const VALID_FEATURES: AIFeature[] = ["course_basics"];
const VALID_PROVIDERS = ["hubfy", "openai"] as const;
const VALID_LANGUAGES = ["pt-BR", "en", "es", "fr", "de", "it"] as const;

type Provider = (typeof VALID_PROVIDERS)[number];

// ── Provider key resolution ─────────────────────────────

/**
 * Resolves the OpenAI API key to use for this request.
 * "hubfy"  → HUBFY_OPENAI_API_KEY env var (our own key)
 * "openai" → tenant's stored credentials
 */
async function resolveApiKey(
  provider: Provider,
  tenantId: string,
  adminClient: ReturnType<typeof createClient>,
): Promise<{ apiKey: string | null; errorCode: string | null }> {
  if (provider === "hubfy") {
    const key = Deno.env.get("HUBFY_OPENAI_API_KEY");
    if (!key) return { apiKey: null, errorCode: "ai_key_missing" };
    return { apiKey: key, errorCode: null };
  }

  // openai → fetch from tenant_integration_secrets
  const { data, error } = await adminClient
    .from("tenant_integrations")
    .select("id, status, tenant_integration_secrets(credentials)")
    .eq("tenant_id", tenantId)
    .eq("provider", "openai")
    .maybeSingle();

  if (error) {
    console.error("Failed to fetch openai integration:", error);
    return { apiKey: null, errorCode: "ai_integration_not_found" };
  }
  if (!data || data.status !== "active") {
    return { apiKey: null, errorCode: "ai_integration_not_found" };
  }

  // supabase-js returns the joined row as an object (1:1 relation)
  const secret = Array.isArray(data.tenant_integration_secrets)
    ? data.tenant_integration_secrets[0]
    : data.tenant_integration_secrets;

  const apiKey = (secret?.credentials as { api_key?: string } | null)?.api_key;

  if (!apiKey) return { apiKey: null, errorCode: "ai_integration_not_found" };
  return { apiKey, errorCode: null };
}

// ── OpenAI call ─────────────────────────────────────────

interface GenerationRequest {
  apiKey: string;
  model: string;
  system: string;
  user: string;
  schema: Record<string, unknown>;
  schemaName: string;
}

interface GenerationResult {
  ok: boolean;
  data?: Record<string, unknown>;
  errorCode?: string;
  errorMessage?: string;
}

async function generateWithOpenAI(req: GenerationRequest): Promise<GenerationResult> {
  let response: Response;
  try {
    response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${req.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: req.model,
        messages: [
          { role: "system", content: req.system },
          { role: "user", content: req.user },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: req.schemaName,
            strict: true,
            schema: req.schema,
          },
        },
      }),
    });
  } catch (err) {
    console.error("OpenAI fetch failed:", err);
    return { ok: false, errorCode: "ai_provider_error", errorMessage: "Network error" };
  }

  if (response.status === 401) {
    return { ok: false, errorCode: "ai_invalid_key" };
  }
  if (response.status === 429) {
    return { ok: false, errorCode: "ai_quota_exceeded" };
  }
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    console.error(`OpenAI ${response.status}:`, body);
    return { ok: false, errorCode: "ai_provider_error" };
  }

  let payload: {
    choices?: Array<{ message?: { content?: string } }>;
  };
  try {
    payload = await response.json();
  } catch {
    return { ok: false, errorCode: "ai_invalid_response" };
  }

  const content = payload.choices?.[0]?.message?.content;
  if (!content) {
    return { ok: false, errorCode: "ai_invalid_response" };
  }

  try {
    const parsed = JSON.parse(content) as Record<string, unknown>;
    return { ok: true, data: parsed };
  } catch {
    return { ok: false, errorCode: "ai_invalid_response" };
  }
}

// ── Feature dispatch ────────────────────────────────────

/**
 * Trims a string to `max` chars. Returns null if the value is not a non-empty
 * string — callers treat null as an invalid-response signal. We never fall
 * back to a hardcoded placeholder because that would leak the wrong language
 * (the client may have requested en/es/fr/etc).
 */
function clampOrNull(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const str = value.trim();
  if (!str) return null;
  return str.length > max ? str.slice(0, max) : str;
}

function handleCourseBasics(raw: Record<string, unknown>): CourseBasicsOutput | null {
  const title = clampOrNull(raw.title, 100);
  const description = clampOrNull(raw.description, 300);
  if (!title || !description) return null;
  return { title, description };
}

// ── Handler ─────────────────────────────────────────────

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
    const tenantId = typeof body?.tenant_id === "string" ? body.tenant_id.trim() : null;
    const feature = typeof body?.feature === "string" ? body.feature : null;
    const provider = typeof body?.provider === "string" ? body.provider : null;
    const language = typeof body?.language === "string" ? body.language : null;
    const input = body?.input;

    if (!tenantId) {
      return jsonResponse({ error: "tenant_id is required", code: "missing_required_field" }, 400);
    }
    if (!feature || !VALID_FEATURES.includes(feature as AIFeature)) {
      return jsonResponse({ error: "Invalid feature", code: "missing_required_field" }, 400);
    }
    if (!provider || !VALID_PROVIDERS.includes(provider as Provider)) {
      return jsonResponse({ error: "Invalid provider", code: "ai_provider_not_supported" }, 400);
    }
    if (!language || !VALID_LANGUAGES.includes(language as typeof VALID_LANGUAGES[number])) {
      return jsonResponse({ error: "Invalid language", code: "missing_required_field" }, 400);
    }

    await authorizeWorkspace(identity, tenantId, supabaseAdmin, { minRole: "editor" });

    const { apiKey, errorCode } = await resolveApiKey(
      provider as Provider,
      tenantId,
      supabaseAdmin,
    );

    if (!apiKey || errorCode) {
      return jsonResponse({ error: errorCode, code: errorCode }, 400);
    }

    const model = provider === "hubfy" ? HUBFY_MODEL : USER_MODEL;

    // ── Feature: course_basics ────────────────
    if (feature === "course_basics") {
      const userInput =
        typeof input?.user_input === "string" ? input.user_input : "";
      const currentTitle =
        typeof input?.current_title === "string" ? input.current_title : undefined;

      if (!userInput.trim()) {
        return jsonResponse({ error: "user_input is required", code: "missing_required_field" }, 400);
      }

      const trimmedInput: CourseBasicsInput = {
        user_input: userInput.slice(0, MAX_USER_INPUT_CHARS),
        current_title: currentTitle,
      };

      const { system, user } = buildCourseBasicsPrompt(trimmedInput, language);

      const result = await generateWithOpenAI({
        apiKey,
        model,
        system,
        user,
        schema: COURSE_BASICS_SCHEMA,
        schemaName: "course_basics",
      });

      if (!result.ok || !result.data) {
        return jsonResponse(
          { error: result.errorMessage ?? result.errorCode ?? "Generation failed", code: result.errorCode ?? "ai_provider_error" },
          400,
        );
      }

      const output = handleCourseBasics(result.data);
      if (!output) {
        return jsonResponse(
          { error: "Invalid AI response", code: "ai_invalid_response" },
          400,
        );
      }
      return jsonResponse({ result: output });
    }

    // Shouldn't reach here (feature already validated above)
    return jsonResponse({ error: "Unhandled feature", code: "internal_error" }, 500);
  } catch (error) {
    console.error("ai-generate error:", error);
    return toErrorResponse(error, corsHeaders);
  }
});
