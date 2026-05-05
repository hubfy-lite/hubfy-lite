import { createClient } from "jsr:@supabase/supabase-js@2";
import {
  authenticateRequest,
  authorizeWorkspace,
  toErrorResponse,
} from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MAX_KEYS_PER_TENANT = 5;

function response(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function generateApiKey(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `sk_live_${hex}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return response(405, { error: "Method not allowed", code: "method_not_allowed" });
  }

  try {
    // ── Auth (JWT-only) ──────────────────────────
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    const identity = await authenticateRequest(req, adminClient);

    // ── Parse body ───────────────────────────────
    const body = await req.json().catch(() => ({}));
    const { action, tenant_id: tenantId, key_id: keyId, label } = body;

    if (!tenantId) {
      return response(400, { error: "tenant_id is required", code: "missing_required_field" });
    }

    // ── Autorizar (owner-only, JWT-only) ─────────
    const auth = await authorizeWorkspace(identity, tenantId, adminClient, {
      minRole: "owner",
      jwtOnly: true,
    });

    // ── Actions ──────────────────────────────────
    switch (action) {
      case "create": {
        // Checar limite
        const { count } = await adminClient
          .from("api_keys")
          .select("id", { count: "exact", head: true })
          .eq("tenant_id", tenantId)
          .is("revoked_at", null);

        if ((count ?? 0) >= MAX_KEYS_PER_TENANT) {
          return response(400, {
            error: `Limit of ${MAX_KEYS_PER_TENANT} active API keys per workspace reached`,
            code: "api_key_limit_reached",
          });
        }

        // Gerar key
        const apiKey = generateApiKey();
        const keyHash = await sha256Hex(apiKey);
        const keyPrefix = apiKey.substring(0, 16); // "sk_live_" + 8 hex chars

        // Inserir via adminClient (bypassa RLS)
        const { data: created, error: insertError } = await adminClient
          .from("api_keys")
          .insert({
            tenant_id: tenantId,
            created_by: auth.userId,
            label: (label ?? "").trim().substring(0, 100),
            key_prefix: keyPrefix,
            key_hash: keyHash,
          })
          .select("id, key_prefix, label, created_at")
          .single();

        if (insertError) {
          return response(500, { error: "Failed to create API key", code: "api_key_create_failed" });
        }

        // Retornar key completa (única vez)
        return response(200, {
          ...created,
          api_key: apiKey,
        });
      }

      case "list": {
        // List usa adminClient com filtro explícito (owner já validado acima)
        const { data: keys, error: listError } = await adminClient
          .from("api_keys")
          .select("id, key_prefix, label, created_at, last_used_at, revoked_at")
          .eq("tenant_id", tenantId)
          .order("created_at", { ascending: false });

        if (listError) {
          return response(500, { error: "Failed to list API keys", code: "internal_error" });
        }

        return response(200, { keys: keys ?? [] });
      }

      case "revoke": {
        if (!keyId) {
          return response(400, { error: "key_id is required", code: "missing_required_field" });
        }

        // Revoke usa adminClient (não depende de policy de UPDATE)
        const { data: revoked, error: revokeError } = await adminClient
          .from("api_keys")
          .update({ revoked_at: new Date().toISOString() })
          .eq("id", keyId)
          .eq("tenant_id", tenantId)
          .is("revoked_at", null)
          .select("id")
          .single();

        if (revokeError || !revoked) {
          return response(404, { error: "API key not found or already revoked", code: "api_key_not_found" });
        }

        return response(200, { success: true });
      }

      default:
        return response(400, {
          error: "action must be 'create', 'list' or 'revoke'",
          code: "invalid_body",
        });
    }
  } catch (err) {
    return toErrorResponse(err, corsHeaders);
  }
});
