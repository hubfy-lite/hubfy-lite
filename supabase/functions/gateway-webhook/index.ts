/**
 * Universal Gateway Webhook Router
 *
 * Entry point único para webhooks de todos os gateways de pagamento.
 * URL: POST /gateway-webhook/{provider}/{tenantId}
 *
 * Fluxo:
 * 1. Valida tenantId e provider
 * 2. Busca integração e credentials
 * 3. Carrega adapter do provider
 * 4. Valida auth (hottok, HMAC, etc.)
 * 5. Normaliza evento
 * 6. Checa lifecycle (ativo vs inativo)
 * 7. Executa pipeline comum
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { getAdapter, KNOWN_PROVIDERS } from "../_shared/gateway/adapters/index.ts";
import { REVOCATION_EVENTS } from "../_shared/gateway/types.ts";
import { logUnauthorizedEvent, updateEventLog, logEventReceived } from "../_shared/gateway/event-logger.ts";
import { processGatewayEvent } from "../_shared/gateway/pipeline.ts";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, supabaseServiceKey);

  /* ── Extrair provider e tenantId do path ── */
  const url = new URL(req.url);
  const segments = url.pathname.split("/").filter(Boolean);
  // /gateway-webhook/{provider}/{tenantId}
  // ou /functions/v1/gateway-webhook/{provider}/{tenantId}
  const gwIdx = segments.indexOf("gateway-webhook");
  const provider = gwIdx >= 0 ? segments[gwIdx + 1] : undefined;
  const tenantId = gwIdx >= 0 ? segments[gwIdx + 2] : undefined;

  if (!provider || !KNOWN_PROVIDERS.includes(provider)) {
    return respond(400, { error: "bad_request", reason: "unknown_provider" });
  }

  if (!tenantId || !UUID_RE.test(tenantId)) {
    return respond(400, { error: "bad_request", reason: "missing_or_invalid_tenant_id" });
  }

  /* ── Parse body (raw + JSON) ── */
  let rawBody: string;
  let body: unknown;

  try {
    rawBody = await req.text();
    body = JSON.parse(rawBody);
  } catch {
    await logUnauthorizedEvent(admin, provider, {}, "JSON inválido no corpo da requisição", { tenantId });
    return respond(400, { error: "invalid_payload" });
  }

  /* ── Buscar integração ── */
  const { data: integration } = await admin
    .from("tenant_integrations")
    .select("id, status")
    .eq("tenant_id", tenantId)
    .eq("provider", provider)
    .maybeSingle();

  if (!integration) {
    await logUnauthorizedEvent(admin, provider, body, `Integração ${provider} não encontrada para tenant ${tenantId}`, {
      tenantId,
    });
    return respond(404, { error: "not_found", reason: "integration_not_found" });
  }

  /* ── Buscar credentials ── */
  const { data: secretRow } = await admin
    .from("tenant_integration_secrets")
    .select("credentials")
    .eq("integration_id", integration.id)
    .maybeSingle();

  if (!secretRow?.credentials) {
    // Sem secrets = tenant desconectou explicitamente
    await logUnauthorizedEvent(admin, provider, body, "Integração sem credenciais (desconectada)", {
      tenantId,
      integrationId: integration.id,
    });
    return respond(401, { error: "unauthorized", reason: "no_credentials" });
  }

  const credentials = secretRow.credentials as Record<string, string>;

  /* ── Carregar adapter ── */
  const adapter = getAdapter(provider)!;

  /* ── Validar auth ── */
  if (!adapter.validateAuth(req, rawBody, body, credentials)) {
    await logUnauthorizedEvent(admin, provider, body, "Autenticação do webhook falhou", {
      tenantId,
      integrationId: integration.id,
      event: (body as Record<string, unknown>)?.event as string | undefined,
      buyerEmail: ((body as Record<string, unknown>)?.data as Record<string, unknown>)?.buyer
        ? (((body as Record<string, unknown>)?.data as Record<string, unknown>)?.buyer as Record<string, unknown>)?.email as string
        : undefined,
    });
    return respond(401, { error: "unauthorized", reason: "auth_failed" });
  }

  /* ── Normalizar evento ── */
  const event = adapter.normalizeEvent(body);

  if (!event) {
    // Evento desconhecido — log como ignored
    const logId = await logEventReceived(admin, {
      tenantId,
      integrationId: integration.id,
      provider,
      event: {
        eventType: "approved",
        externalOrderId: "",
        externalProductId: "",
        buyer: { email: "", name: "" },
        amountCents: 0,
        paymentMethod: "",
        currency: "BRL",
        isSubscription: false,
        isOrderBump: false,
        rawEvent: (body as Record<string, unknown>)?.event as string ?? "unknown",
      },
      rawPayload: body,
    });
    await updateEventLog(admin, logId, "ignored", `Evento não processado pelo Hubfy.`);
    return respond(200, { received: true, status: "ignored" });
  }

  /* ── Checar lifecycle ── */
  const isActive = integration.status === "active";
  const isRevocationEvent = REVOCATION_EVENTS.includes(event.eventType);

  if (!isActive && !isRevocationEvent) {
    // Gateway inativo + evento de compra = rejeitar
    const logId = await logEventReceived(admin, {
      tenantId,
      integrationId: integration.id,
      provider,
      event,
      rawPayload: body,
    });
    await updateEventLog(admin, logId, "ignored", "Gateway inativo. Apenas eventos de cancelamento/reembolso/chargeback são processados.");
    return respond(200, { received: true, status: "ignored", reason: "gateway_inactive" });
  }

  /* ── Executar pipeline ── */
  const result = await processGatewayEvent(admin, {
    tenantId,
    integrationId: integration.id,
    provider,
    event,
    rawPayload: body,
  });

  const httpStatus = result.status === "failed" ? 500 : 200;
  return respond(httpStatus, {
    received: true,
    ...result,
  });
});

/* ─── Helper ───────────────────────────────────────────────── */

function respond(status: number, data: Record<string, unknown>): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
