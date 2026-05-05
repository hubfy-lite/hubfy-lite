// Shared email helper: send via Resend + log to email_logs
// Used by: customer-auth-start, resend-customer-invite, resend-team-invite

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";

/* ─── Types ─── */

export type EmailLogType =
  | "portal_access"
  | "customer_invite"
  | "access_granted"
  | "team_invite"
  | "reconciliation"
  | "signup_confirmation"
  | "password_reset"
  | "email_change"
  | "magic_link"
  | "auth_invite"
  | "creator_welcome";

export interface SendAndLogParams {
  resendApiKey: string;
  supabaseAdmin: SupabaseClient;
  senderName: string;
  to: string;
  subject: string;
  html: string;
  // contexto para o log
  tenantId: string | null;
  emailType: EmailLogType;
  customerId?: string;
  orderId?: string;
  userId?: string;
  metadata?: Record<string, unknown>;
}

export interface SendAndLogResult {
  ok: boolean;
  resendMessageId?: string;
  emailLogId?: string;
  error?: string;
}

/* ─── Main function ─── */

export async function sendAndLogEmail(
  params: SendAndLogParams,
): Promise<SendAndLogResult> {
  const {
    resendApiKey,
    supabaseAdmin,
    senderName,
    to,
    subject,
    html,
    tenantId,
    emailType,
    customerId,
    orderId,
    userId,
    metadata,
  } = params;

  // Build Resend tags for webhook correlation (max 5)
  const tags: Array<{ name: string; value: string }> = [
    { name: "email_type", value: emailType },
  ];
  if (tenantId) tags.push({ name: "tenant_id", value: tenantId });
  if (!tenantId && userId) tags.push({ name: "user_id", value: userId });
  if (orderId) tags.push({ name: "order_id", value: orderId });
  if (customerId) tags.push({ name: "customer_id", value: customerId });

  // Send via Resend API
  let resendMessageId: string | undefined;
  let sendError: string | undefined;
  let sendOk = false;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `${senderName} <${Deno.env.get("EMAIL_FROM_ADDRESS") ?? "noreply@notifications.example.com"}>`,
        to: [to],
        subject,
        html,
        tags,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      resendMessageId = data?.id;
      sendOk = true;
    } else {
      const body = await res.json().catch(() => ({}));
      sendError =
        body?.message || body?.error || `Resend HTTP ${res.status}`;
      if (typeof sendError !== "string") sendError = JSON.stringify(sendError);
      console.error("send-email: Resend error:", body);
    }
  } catch (err) {
    sendError = err instanceof Error ? err.message : "Network error";
    console.error("send-email: fetch error:", err);
  }

  // Log to email_logs (fire-and-forget safe — errors here don't affect the caller)
  let emailLogId: string | undefined;

  try {
    const { data: logRow, error: logError } = await supabaseAdmin
      .from("email_logs")
      .insert({
        tenant_id: tenantId,
        customer_id: customerId || null,
        order_id: orderId || null,
        user_id: userId || null,
        recipient_email: to,
        subject,
        email_type: emailType,
        status: sendOk ? "sent" : "failed",
        resend_message_id: resendMessageId || null,
        error_message: sendError || null,
        metadata: metadata || {},
        sent_at: sendOk ? new Date().toISOString() : null,
      })
      .select("id")
      .single();

    if (logError) {
      console.error("send-email: log insert error:", logError);
    } else {
      emailLogId = logRow?.id;
    }
  } catch (logErr) {
    console.error("send-email: log insert exception:", logErr);
  }

  return {
    ok: sendOk,
    resendMessageId,
    emailLogId,
    error: sendError,
  };
}
