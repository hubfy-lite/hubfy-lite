/**
 * ai-provider-connect
 *
 * Validates an AI provider API key, creates/updates the tenant integration,
 * and stores the key securely.
 *
 * POST { tenant_id, provider: "openai" | "anthropic", api_key: string }
 * Auth: tenant editor
 *
 * Returns: { integration: { id, provider, account_name, status, credentials_hint, ... } }
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

function maskKey(key: string): string {
  return key.length > 4 ? "••••" + key.slice(-4) : "••••";
}

const VALID_PROVIDERS = ["openai", "anthropic"] as const;
type AIProvider = (typeof VALID_PROVIDERS)[number];

/** Validates the API key by making a lightweight test call to the provider. */
async function validateKey(
  provider: AIProvider,
  apiKey: string,
): Promise<{ valid: boolean; accountName: string | null; error: string | null }> {
  try {
    if (provider === "openai") {
      // GET /v1/models — lightweight, no cost
      const res = await fetch("https://api.openai.com/v1/models", {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      if (res.status === 401) {
        return { valid: false, accountName: null, error: "API key inválida ou expirada" };
      }
      if (!res.ok) {
        return { valid: false, accountName: null, error: `Erro na API OpenAI: ${res.status}` };
      }
      return { valid: true, accountName: "OpenAI", error: null };
    }

    if (provider === "anthropic") {
      // POST /v1/messages with max_tokens=1 — minimal cost
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 1,
          messages: [{ role: "user", content: "hi" }],
        }),
      });
      if (res.status === 401) {
        return { valid: false, accountName: null, error: "API key inválida ou expirada" };
      }
      if (res.status === 403) {
        return { valid: false, accountName: null, error: "API key sem permissão" };
      }
      // 200 or 400 (model not available) both mean the key is valid
      if (res.ok || res.status === 400 || res.status === 429) {
        return { valid: true, accountName: "Anthropic", error: null };
      }
      return { valid: false, accountName: null, error: `Erro na API Anthropic: ${res.status}` };
    }

    return { valid: false, accountName: null, error: "Provider não suportado" };
  } catch (err) {
    return {
      valid: false,
      accountName: null,
      error: err instanceof Error ? err.message : "Erro ao validar chave",
    };
  }
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

    // Parse body
    const body = await req.json();
    const tenantId =
      typeof body?.tenant_id === "string" ? body.tenant_id.trim() : null;
    const provider =
      typeof body?.provider === "string" ? body.provider.trim() : null;
    const apiKey =
      typeof body?.api_key === "string" ? body.api_key.trim() : null;

    if (!tenantId) {
      return jsonResponse({ error: "tenant_id is required", code: "missing_required_field" }, 400);
    }
    if (!provider || !VALID_PROVIDERS.includes(provider as AIProvider)) {
      return jsonResponse({ error: "Invalid provider", code: "missing_required_field" }, 400);
    }
    if (!apiKey) {
      return jsonResponse({ error: "api_key is required", code: "missing_required_field" }, 400);
    }

    // Validate user is editor of this tenant
    await authorizeWorkspace(identity, tenantId, supabaseAdmin, { minRole: "editor" });

    // Validate API key with provider
    const validation = await validateKey(provider as AIProvider, apiKey);

    if (!validation.valid) {
      return jsonResponse({ error: validation.error ?? "Invalid key", code: "invalid_api_key" }, 400);
    }

    // Build masked hint
    const keyHint = maskKey(apiKey);

    // Atomic upsert: integration + secret in one transaction
    const { data: integration, error: connectError } = await supabaseAdmin
      .rpc("connect_integration", {
        p_tenant_id: tenantId,
        p_provider: provider,
        p_metadata: {
          account_name: validation.accountName,
        },
        p_credentials: { api_key: apiKey },
        p_credentials_hint: { api_key: keyHint },
      })
      .single();

    if (connectError || !integration) {
      console.error("Failed to connect integration:", connectError);
      return jsonResponse({ error: "Failed to save integration", code: "integration_save_failed" }, 500);
    }

    return jsonResponse({ integration });
  } catch (error) {
    console.error("ai-provider-connect error:", error);
    return toErrorResponse(error, corsHeaders);
  }
});
