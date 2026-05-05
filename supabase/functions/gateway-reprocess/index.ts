/**
 * Gateway Reprocess
 *
 * Reprocessa um gateway_event pelo ID.
 * Usado para reprocessar eventos que falharam ou foram ignorados.
 *
 * Body: { event_id: string }
 *
 * Diferente de reinvocar a function pública (que exige headers de assinatura
 * como HMAC), este endpoint carrega o raw_payload do banco e re-entra
 * direto no pipeline.
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { authenticateRequest, authorizeWorkspace, toErrorResponse } from "../_shared/auth.ts";
import { getAdapter } from "../_shared/gateway/adapters/index.ts";
import { processGatewayEvent } from "../_shared/gateway/pipeline.ts";
import { updateEventLog } from "../_shared/gateway/event-logger.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // ── 1. Admin client ──
    const admin = createClient(supabaseUrl, supabaseServiceKey);

    // ── 2. Authenticate (who are you?) ──
    const identity = await authenticateRequest(req, admin);

    // ── 3. Parse body ──
    let eventId: string;
    try {
      const body = await req.json();
      eventId = body.event_id;
    } catch {
      return respond(400, { error: "expected { event_id: string }", code: "invalid_body" });
    }

    if (!eventId) {
      return respond(400, { error: "event_id is required", code: "missing_required_field" });
    }

    // ── 4. Load resource to discover tenant_id ──
    const { data: eventRow, error: fetchErr } = await admin
      .from("gateway_events")
      .select("id, tenant_id, integration_id, provider, raw_payload, status, retry_count")
      .eq("id", eventId)
      .single();

    if (fetchErr || !eventRow) {
      return respond(404, { error: "Event not found", code: "internal_error" });
    }

    // ── 5. Authorize workspace ──
    await authorizeWorkspace(identity, eventRow.tenant_id, admin, { minRole: "editor" });

    // ── 6. Carregar adapter ──
    const adapter = getAdapter(eventRow.provider);
    if (!adapter) {
      return respond(400, { error: `Unknown provider: ${eventRow.provider}`, code: "internal_error" });
    }

    // ── 7. Normalizar evento (PULA validateAuth) ──
    const event = adapter.normalizeEvent(eventRow.raw_payload);

    if (!event) {
      await updateEventLog(admin, eventRow.id, "ignored", "Evento não reconhecido pelo adapter no reprocess.");
      return respond(200, { status: "ignored", reason: "unrecognized_event" });
    }

    // ── 8. Incrementar retry_count ──
    await admin
      .from("gateway_events")
      .update({ retry_count: (eventRow.retry_count ?? 0) + 1 })
      .eq("id", eventRow.id);

    // ── 9. Executar pipeline ──
    const result = await processGatewayEvent(admin, {
      tenantId: eventRow.tenant_id,
      integrationId: eventRow.integration_id,
      provider: eventRow.provider,
      event,
      rawPayload: eventRow.raw_payload,
    });

    return respond(result.status === "failed" ? 500 : 200, {
      reprocessed: true,
      event_id: eventId,
      ...result,
    });
  } catch (error: unknown) {
    console.error("gateway-reprocess error:", error);
    return toErrorResponse(error, corsHeaders);
  }
});

function respond(status: number, data: Record<string, unknown>): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
