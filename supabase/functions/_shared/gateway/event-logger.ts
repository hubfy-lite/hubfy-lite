/**
 * Gateway Event Logger
 *
 * Log imutável de webhooks recebidos em gateway_events.
 */

import type { AdminClient, PipelineContext } from "./types.ts";

export async function logEventReceived(
  admin: AdminClient,
  ctx: PipelineContext,
): Promise<string | null> {
  const { data: row } = await admin
    .from("gateway_events")
    .insert({
      tenant_id: ctx.tenantId,
      integration_id: ctx.integrationId,
      provider: ctx.provider,
      event_type: ctx.event.rawEvent.toLowerCase(),
      external_event_type: ctx.event.rawEvent,
      external_order_id: ctx.event.externalOrderId || null,
      external_offer_id: ctx.event.externalProductId || null,
      buyer_email: ctx.event.buyer.email || null,
      raw_payload: ctx.rawPayload,
      status: "received",
    })
    .select("id")
    .single();

  return row?.id ?? null;
}

export async function updateEventLog(
  admin: AdminClient,
  logId: string | null,
  status: string,
  errorMessage?: string | null,
  result?: Record<string, unknown>,
): Promise<void> {
  if (!logId) return;
  await admin
    .from("gateway_events")
    .update({
      status,
      error_message: errorMessage ?? null,
      result: result ?? null,
      processed_at: status === "processed" ? new Date().toISOString() : null,
    })
    .eq("id", logId);
}

export async function logUnauthorizedEvent(
  admin: AdminClient,
  provider: string,
  rawPayload: unknown,
  errorMessage: string,
  opts?: {
    tenantId?: string | null;
    integrationId?: string | null;
    event?: string | null;
    buyerEmail?: string | null;
    externalOrderId?: string | null;
  },
): Promise<void> {
  try {
    await admin.from("gateway_events").insert({
      tenant_id: opts?.tenantId ?? null,
      integration_id: opts?.integrationId ?? null,
      provider,
      event_type: opts?.event?.toLowerCase() || "unknown",
      external_event_type: opts?.event || null,
      buyer_email: opts?.buyerEmail ?? null,
      external_order_id: opts?.externalOrderId ?? null,
      raw_payload: rawPayload,
      status: "unauthorized",
      error_message: errorMessage,
    });
  } catch (e) {
    console.error(`${provider}: falha ao registrar evento unauthorized:`, e);
  }
}
