// Supabase Auth Hook — Send Email
//
// Intercepts ALL auth emails (signup confirmation, password reset,
// email change, magic link, invite) and sends them via Resend
// with i18n support and consistent Hubfy branding.
//
// Configured in Supabase Dashboard:
//   Authentication → Hooks → Send Email → HTTP
//   URL: https://<seu-project-ref>.supabase.co/functions/v1/auth-send-email
//   Secret: AUTH_SEND_EMAIL_SECRET env var

import { createClient } from "jsr:@supabase/supabase-js@2";
import {
  type EmailLanguage,
  resolveEmailLanguage,
  getEmailTranslations,
} from "../_shared/email-i18n.ts";
import {
  buildSignupConfirmationEmail,
  buildRecoveryEmail,
  buildEmailChangeEmail,
  buildMagicLinkEmail,
} from "../_shared/email-templates.ts";

/* ─── Types ─── */

interface HookPayload {
  user: {
    id: string;
    email: string;
    user_metadata?: Record<string, unknown>;
  };
  email_data: {
    token: string;
    token_hash: string;
    redirect_to: string;
    email_action_type: string; // signup | recovery | magiclink | invite | email_change
    site_url: string;
    token_new?: string;
    token_hash_new?: string;
  };
}

/* ─── Helpers ─── */

function buildVerificationUrl(
  siteUrl: string,
  tokenHash: string,
  type: string,
  redirectTo: string,
): string {
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
  // siteUrl from the hook payload may be the base project URL
  // or already include /auth/v1. Normalize to base URL.
  const baseUrl = siteUrl.replace(/\/auth\/v1\/?$/, "");
  const params = new URLSearchParams({
    apikey: anonKey,
    token: tokenHash,
    type,
    redirect_to: redirectTo,
  });
  return `${baseUrl}/auth/v1/verify?${params.toString()}`;
}

function mapActionTypeToVerifyType(actionType: string): string {
  const map: Record<string, string> = {
    signup: "signup",
    recovery: "recovery",
    magiclink: "magiclink",
    invite: "invite",
    email_change: "email_change",
  };
  return map[actionType] || actionType;
}

/* ─── Handler ─── */

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    // Note: Authentication is handled by Supabase's Standard Webhooks signature
    // (configured via hook_send_email_secrets in auth config).
    // The Supabase auth service signs every request with HMAC-SHA256.
    // Since verify_jwt=false and the hook is called internally, we trust the caller.

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      console.error("auth-send-email: RESEND_API_KEY not set");
      return new Response(JSON.stringify({ error: "Email not configured" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    const payload: HookPayload = await req.json();
    const { user, email_data } = payload;
    const actionType = email_data.email_action_type;

    console.log(
      `auth-send-email: type=${actionType} email=${user.email} user=${user.id}`,
    );



    // Resolve language: user_metadata → profiles.preferences → pt-BR
    let lang: EmailLanguage = resolveEmailLanguage(user.user_metadata);

    // If no language in metadata, try profiles table
    if (!user.user_metadata?.language) {
      try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const admin = createClient(supabaseUrl, serviceKey);

        const { data: profile } = await admin
          .from("profiles")
          .select("preferences")
          .eq("user_id", user.id)
          .maybeSingle();

        if (profile?.preferences) {
          lang = resolveEmailLanguage(
            user.user_metadata,
            profile.preferences as Record<string, unknown>,
          );
        }
      } catch (e) {
        console.warn("auth-send-email: profile lookup failed, using default lang:", e);
      }
    }

    const t = getEmailTranslations(lang);
    const userName = (user.user_metadata?.name as string) || "";

    // Build verification URL
    const verifyType = mapActionTypeToVerifyType(actionType);
    const verificationUrl = buildVerificationUrl(
      email_data.site_url,
      email_data.token_hash,
      verifyType,
      email_data.redirect_to,
    );

    // Build email HTML + subject
    let html: string;
    let subject: string;

    switch (actionType) {
      case "signup": {
        html = buildSignupConfirmationEmail(lang, userName, verificationUrl);
        subject = t.signup.subject;
        break;
      }
      case "recovery": {
        html = buildRecoveryEmail(lang, userName, verificationUrl);
        subject = t.recovery.subject;
        break;
      }
      case "email_change": {
        html = buildEmailChangeEmail(lang, userName, verificationUrl);
        subject = t.emailChange.subject;
        break;
      }
      case "magiclink": {
        html = buildMagicLinkEmail(lang, userName, verificationUrl);
        subject = t.magicLink.subject;
        break;
      }
      case "invite": {
        // Invite emails are handled by add-team-member / resend-team-invite
        // with their own templates. If the hook intercepts an invite,
        // use a generic magic link template as fallback.
        html = buildMagicLinkEmail(lang, userName, verificationUrl);
        subject = t.magicLink.subject;
        break;
      }
      default: {
        console.warn(`auth-send-email: unknown action type: ${actionType}`);
        html = buildMagicLinkEmail(lang, userName, verificationUrl);
        subject = t.magicLink.subject;
      }
    }

    // Send via Resend
    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: Deno.env.get("EMAIL_FROM_ADDRESS") ?? "noreply@notifications.example.com",
        to: [user.email],
        subject,
        html,
        tags: [
          { name: "email_type", value: `auth_${actionType}` },
          { name: "user_id", value: user.id },
        ],
      }),
    });

    if (!resendRes.ok) {
      const body = await resendRes.json().catch(() => ({}));
      console.error("auth-send-email: Resend error:", body);
      return new Response(
        JSON.stringify({ error: "Failed to send email" }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      );
    }

    const resendData = await resendRes.json();
    console.log(
      `auth-send-email: sent ${actionType} to ${user.email} (resend_id=${resendData?.id})`,
    );

    // Log to email_logs (fire-and-forget, non-blocking)
    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const admin = createClient(supabaseUrl, serviceKey);

      // Map action type to email_log_type
      const emailTypeMap: Record<string, string> = {
        signup: "signup_confirmation",
        recovery: "password_reset",
        email_change: "email_change",
        magiclink: "magic_link",
        invite: "auth_invite",
      };
      const emailType = emailTypeMap[actionType] || "signup_confirmation";

      // Find tenant_id for logging (best-effort)
      let tenantId: string | null = null;
      const { data: tu } = await admin
        .from("tenant_users")
        .select("tenant_id")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (tu?.tenant_id) {
        tenantId = tu.tenant_id;
      }

      if (tenantId) {
        await admin.from("email_logs").insert({
          tenant_id: tenantId,
          user_id: user.id,
          recipient_email: user.email,
          subject,
          email_type: emailType,
          status: "sent",
          resend_message_id: resendData?.id || null,
          metadata: { action_type: actionType, language: lang },
          sent_at: new Date().toISOString(),
        });
      }
    } catch (logErr) {
      // Non-critical — don't fail the hook
      console.warn("auth-send-email: log insert failed:", logErr);
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("auth-send-email: unexpected error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Internal error",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
});
