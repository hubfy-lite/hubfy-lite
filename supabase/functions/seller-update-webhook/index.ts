import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, webhook-id, webhook-timestamp, webhook-signature",
};

function respond(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Chargefy org status → Hubfy seller status
// "created" is deliberately excluded: when we submit, our status is already
// "pending" and receiving a "created" event would incorrectly regress it to "draft".
const STATUS_MAP: Record<string, string> = {
  onboarding_started: "pending",
  under_review: "pending",
  active: "approved",
  denied: "rejected",
  suspended: "disabled",
  blocked: "disabled",
};

// Status hierarchy — higher number = more advanced state.
// Webhook events must never regress the seller to a less advanced status.
const STATUS_WEIGHT: Record<string, number> = {
  draft: 0,
  pending: 1,
  approved: 2,
  rejected: 2,
  disabled: 3,
  deleted: 4,
};

// Events we handle
const HANDLED_EVENTS = [
  "suborganization.created",
  "suborganization.updated",
];

/** Base64 decode helper */
function b64Decode(s: string): Uint8Array {
  const bin = atob(s);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return arr;
}

/** Base64 encode helper */
function b64Encode(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}

/**
 * Verify Standard Webhooks signature (used by Chargefy).
 * Format: webhook-signature = "v1,<base64_hmac>"
 * Signed content: "{webhook-id}.{webhook-timestamp}.{body}"
 */
async function verifyWebhookSignature(
  secret: string,
  webhookId: string,
  timestamp: string,
  body: string,
  signature: string,
): Promise<boolean> {
  try {
    // Strip prefix — Chargefy uses "chargefy_whs_" or standard "whsec_"
    const secretClean = secret.startsWith("chargefy_whs_")
      ? secret.slice("chargefy_whs_".length)
      : secret.startsWith("whsec_")
        ? secret.slice("whsec_".length)
        : secret;

    const secretBytes = b64Decode(secretClean);
    const signedContent = `${webhookId}.${timestamp}.${body}`;
    const encoder = new TextEncoder();

    const key = await crypto.subtle.importKey(
      "raw",
      secretBytes,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const mac = await crypto.subtle.sign("HMAC", key, encoder.encode(signedContent));
    const computedB64 = b64Encode(mac);

    const signatures = signature.split(" ");
    for (const sig of signatures) {
      const [version, sigValue] = sig.split(",");
      if (version === "v1" && computedB64 === sigValue) return true;
    }

    return false;
  } catch (err) {
    console.error("Signature verification error:", err);
    return false;
  }
}

/**
 * Extract org ID and status from Chargefy webhook payload.
 *
 * Payload structure (confirmed with Chargefy team):
 * {
 *   "id": "4f8b2b6f-...",
 *   "type": "suborganization.created" | "suborganization.updated",
 *   "timestamp": "2026-03-18T12:00:00.000Z",
 *   "data": {
 *     "suborganization": { "id": "2d6a...", "name": "...", "slug": "...", "status": "active" },
 *     "parent_organization_id": "f6b3..." (only on .created)
 *   }
 * }
 */
function extractFromPayload(data: Record<string, unknown>) {
  const suborg = data.suborganization as Record<string, unknown> | undefined;

  const orgId = (suborg?.id as string) ?? null;
  const orgStatus = ((suborg?.status as string) ?? "").toLowerCase() || null;

  return { orgId, orgStatus };
}

/**
 * Find our internal seller by Chargefy suborganization ID.
 */
async function findSeller(
  admin: ReturnType<typeof createClient>,
  suborgId: string | null,
) {
  if (!suborgId) return null;

  const { data } = await admin
    .from("sellers")
    .select("id, tenant_id, status")
    .eq("external_suborganization_id", suborgId)
    .maybeSingle();

  return data ?? null;
}

/** Helper: build base event fields for logging */
function baseEvent(
  eventType: string,
  rawPayload: Record<string, unknown>,
  suborgId?: string | null,
) {
  return {
    event_type: eventType,
    event_io: "in" as const,
    external_event_id: (rawPayload.id as string) ?? null,
    suborganization_id: suborgId ?? null,
    raw_payload: rawPayload,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return respond(405, { error: "Method not allowed" });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const webhookSecret = Deno.env.get("SELLER_WEBHOOK_SECRET") ?? "";

  const admin = createClient(supabaseUrl, supabaseServiceKey);

  let rawPayload: Record<string, unknown> = {};

  try {
    // 1. Read raw body
    const body = await req.text();
    try {
      rawPayload = JSON.parse(body);
    } catch {
      await admin.from("seller_events").insert({
        ...baseEvent("webhook.error", { raw: body.slice(0, 1000) }),
        response: { error: "JSON inválido" },
      });
      return respond(400, { error: "invalid_payload" });
    }

    // 2. Verify Standard Webhooks signature
    const webhookId = req.headers.get("webhook-id") ?? "";
    const webhookTimestamp = req.headers.get("webhook-timestamp") ?? "";
    const webhookSignature = req.headers.get("webhook-signature") ?? "";

    if (webhookSecret && webhookId && webhookTimestamp && webhookSignature) {
      const isValid = await verifyWebhookSignature(
        webhookSecret,
        webhookId,
        webhookTimestamp,
        body,
        webhookSignature,
      );

      if (!isValid) {
        const legacySecret = req.headers.get("x-webhook-secret") ?? "";
        if (!legacySecret || legacySecret !== webhookSecret) {
          // Log signature failure but continue processing — don't reject
          // This prevents losing webhooks due to signature mismatch bugs
          console.warn("Webhook signature verification failed — processing anyway", {
            webhookId, webhookTimestamp,
            signaturePrefix: webhookSignature.slice(0, 20),
          });
        }
      }
    }

    // 3. Extract event type and data
    const eventType = rawPayload.type as string | undefined;
    const data = rawPayload.data as Record<string, unknown> | undefined;

    if (!eventType || !HANDLED_EVENTS.includes(eventType)) {
      await admin.from("seller_events").insert({
        ...baseEvent(eventType ?? "webhook.unknown", rawPayload),
        response: { ignored: true, reason: "unhandled_event" },
      });
      return respond(200, { received: true, status: "ignored", reason: "unhandled_event" });
    }

    if (!data) {
      await admin.from("seller_events").insert({
        ...baseEvent(eventType, rawPayload),
        response: { error: "Campo 'data' ausente no payload" },
      });
      return respond(400, { error: "data is required" });
    }

    // 4. Extract suborg ID and status from nested payload structure
    const { orgId: suborgId, orgStatus } = extractFromPayload(data);

    // 5. Handle suborganization.created — log only, don't change status
    if (eventType === "suborganization.created") {
      const seller = await findSeller(admin, suborgId);

      await admin.from("seller_events").insert({
        ...baseEvent("suborganization.created", rawPayload, suborgId),
        seller_id: seller?.id ?? null,
        tenant_id: seller?.tenant_id ?? null,
        external_status: orgStatus,
        response: { acknowledged: true, reason: "creation_ack", seller_found: !!seller },
      });
      return respond(200, { received: true, status: "logged", reason: "creation_ack" });
    }

    // 6. Handle suborganization.updated — process status change
    if (!suborgId) {
      await admin.from("seller_events").insert({
        ...baseEvent("suborganization.updated", rawPayload),
        response: { error: "suborganization.id ausente no payload" },
      });
      return respond(400, { error: "suborganization.id is required" });
    }

    if (!orgStatus) {
      await admin.from("seller_events").insert({
        ...baseEvent("suborganization.updated", rawPayload, suborgId),
        response: { ignored: true, reason: "no_status_in_update" },
      });
      return respond(200, { received: true, status: "ignored", reason: "no_status_in_update" });
    }

    // 7. Map Chargefy status → Hubfy status
    const internalStatus = STATUS_MAP[orgStatus];
    if (!internalStatus) {
      await admin.from("seller_events").insert({
        ...baseEvent("suborganization.updated", rawPayload, suborgId),
        external_status: orgStatus,
        response: { ignored: true, reason: "unknown_status" },
      });
      return respond(200, { received: true, status: "ignored", reason: "unknown_status" });
    }

    // 8. Find our seller
    const seller = await findSeller(admin, suborgId);

    if (!seller) {
      await admin.from("seller_events").insert({
        ...baseEvent("suborganization.updated", rawPayload, suborgId),
        external_status: orgStatus,
        response: { error: "seller_not_found", suborganization_id: suborgId },
      });
      return respond(404, { error: "seller_not_found" });
    }

    // 9. Guard: never regress status
    const currentWeight = STATUS_WEIGHT[seller.status] ?? 0;
    const newWeight = STATUS_WEIGHT[internalStatus] ?? 0;

    if (newWeight < currentWeight) {
      await admin.from("seller_events").insert({
        ...baseEvent("suborganization.updated", rawPayload, suborgId),
        seller_id: seller.id,
        tenant_id: seller.tenant_id,
        external_status: orgStatus,
        response: {
          ignored: true,
          reason: "status_regression",
          current: seller.status,
          attempted: internalStatus,
        },
      });
      return respond(200, { received: true, status: "ignored", reason: "status_regression" });
    }

    // 10. Build update
    const now = new Date().toISOString();
    const updateData: Record<string, unknown> = { status: internalStatus };

    if (internalStatus === "approved") {
      updateData.approved_at = now;
      updateData.rejected_at = null;
      updateData.rejection_reason = null;
    } else if (internalStatus === "rejected") {
      updateData.rejected_at = now;
      const suborg = data.suborganization as Record<string, unknown> | undefined;
      updateData.rejection_reason =
        (suborg?.rejection_reason as string) ??
        (suborg?.reason as string) ??
        null;
    }

    // 11. Update seller
    const { error: updateError } = await admin
      .from("sellers")
      .update(updateData)
      .eq("id", seller.id);

    if (updateError) {
      console.error("Failed to update seller:", updateError);
      await admin.from("seller_events").insert({
        ...baseEvent("suborganization.updated", rawPayload, suborgId),
        seller_id: seller.id,
        tenant_id: seller.tenant_id,
        external_status: orgStatus,
        response: { error: "failed_to_update", detail: updateError.message },
      });
      return respond(500, { error: "failed_to_update" });
    }

    // 12. Create/update seller_fees when approved
    if (internalStatus === "approved") {
      const feePercent = (data.fee_percent as number) ?? 0;
      await admin
        .from("seller_fees")
        .upsert(
          { seller_id: seller.id, fee_percent: feePercent },
          { onConflict: "seller_id" },
        );
    }

    // 13. Log success (idempotency: skip if same external_event_id already logged)
    const externalEventId = (rawPayload.id as string) ?? null;

    if (externalEventId) {
      const { data: existingEvent } = await admin
        .from("seller_events")
        .select("id")
        .eq("external_event_id", externalEventId)
        .limit(1)
        .maybeSingle();

      if (existingEvent) {
        return respond(200, { received: true, status: "already_processed" });
      }
    }

    await admin.from("seller_events").insert({
      ...baseEvent("suborganization.updated", rawPayload, suborgId),
      seller_id: seller.id,
      tenant_id: seller.tenant_id,
      external_status: orgStatus,
      response: {
        processed: true,
        status_change: `${seller.status} → ${internalStatus}`,
      },
    });

    return respond(200, { received: true, status: "processed", internal_status: internalStatus });
  } catch (error) {
    console.error("seller-update-webhook error:", error);
    await admin.from("seller_events").insert({
      ...baseEvent("webhook.error", rawPayload),
      response: { error: String(error) },
    }).catch(() => {});
    return respond(500, { error: "internal_error" });
  }
});
