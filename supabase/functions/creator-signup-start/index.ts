// Edge function: creator-signup-start
//
// Pre-check before creator (tenant) signup.
// Classifies the email and handles upgrade from customer → tenant.
//
// Returns:
//   { status: "proceed_signup" }  — new user, frontend does normal signUp()
//   { status: "check_email" }     — upgrade done (or re-done), check inbox
//   { status: "email_taken" }     — already a tenant with workspace, use login

import { createClient } from "jsr:@supabase/supabase-js@2";
import { resolvePublicSiteUrl } from "../_shared/site-url.ts";
import {
  type EmailLanguage,
  resolveEmailLanguage,
  getEmailTranslations,
} from "../_shared/email-i18n.ts";
import { buildCreatorWelcomeEmail } from "../_shared/email-templates.ts";
import { sendAndLogEmail } from "../_shared/send-email.ts";

/* ─── Helpers ─── */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function resolveUserLanguage(
  admin: ReturnType<typeof createClient>,
  userId: string,
  fallbackLang?: string,
): Promise<EmailLanguage> {
  try {
    const { data: authUser } = await admin.auth.admin.getUserById(userId);
    const meta = authUser?.user?.user_metadata ?? null;

    if (meta?.language) {
      return resolveEmailLanguage(meta);
    }

    const { data: profile } = await admin
      .from("profiles")
      .select("preferences")
      .eq("user_id", userId)
      .maybeSingle();

    const resolved = resolveEmailLanguage(
      meta,
      profile?.preferences as Record<string, unknown> | null,
    );

    // If neither metadata nor profile had a language, use caller-provided fallback
    if (resolved === "pt-BR" && fallbackLang) {
      if (fallbackLang === "en") return "en";
      if (fallbackLang === "es") return "es";
    }

    return resolved;
  } catch {
    return "pt-BR";
  }
}

/* ─── Handler ─── */

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed", code: "method_not_allowed" }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const admin = createClient(supabaseUrl, serviceKey);

    const body = await req.json();
    const email = (body.email ?? "").trim().toLowerCase();
    const name = (body.name ?? "").trim();
    const language = (body.language ?? "").trim();
    const origin = body.origin ?? null;

    if (!email) {
      return jsonResponse({ error: "email is required", code: "missing_required_field" }, 400);
    }

    const siteUrl = resolvePublicSiteUrl(origin);
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";

    // ── Rate limiting ──

    const { data: recentByEmail } = await admin
      .from("creator_signup_requests")
      .select("id")
      .eq("email", email)
      .gte("created_at", new Date(Date.now() - 60_000).toISOString())
      .limit(1);

    if (recentByEmail && recentByEmail.length > 0) {
      return jsonResponse(
        { error: "Email rate limited", code: "rate_limit_email", error_code: "RATE_LIMIT_EMAIL", retry_after_seconds: 60 },
        429,
      );
    }

    const { data: recentByIp } = await admin
      .from("creator_signup_requests")
      .select("id")
      .eq("ip_address", ip)
      .gte("created_at", new Date(Date.now() - 300_000).toISOString())
      .limit(6);

    if (recentByIp && recentByIp.length >= 5) {
      return jsonResponse(
        { error: "IP rate limited", code: "rate_limit_ip", error_code: "RATE_LIMIT_IP", retry_after_seconds: 300 },
        429,
      );
    }

    // Log request for rate limiting
    await admin
      .from("creator_signup_requests")
      .insert({ email, ip_address: ip });

    // Probabilistic cleanup (1 in 10 requests)
    if (Math.random() < 0.1) {
      admin
        .from("creator_signup_requests")
        .delete()
        .lt("created_at", new Date(Date.now() - 3600_000).toISOString())
        .then(() => {})
        .catch(() => {});
    }

    // ── Lookup user ──

    const { data: userId } = await admin.rpc("get_user_id_by_email", {
      p_email: email,
    });

    if (!userId) {
      // NEW_USER — frontend will do normal supabase.auth.signUp()
      return jsonResponse({ status: "proceed_signup" });
    }

    // ── Classify existing user ──

    const [{ data: roles }, { data: workspace }] = await Promise.all([
      admin
        .from("user_roles")
        .select("role")
        .eq("user_id", userId),
      admin
        .from("tenant_users")
        .select("user_id")
        .eq("user_id", userId)
        .limit(1)
        .maybeSingle(),
    ]);

    const roleSet = new Set((roles ?? []).map((r: { role: string }) => r.role));
    const hasTenantRole = roleSet.has("tenant");
    const hasCustomerRole = roleSet.has("customer");
    const hasWorkspace = !!workspace;

    type Classification =
      | "ACTIVE_TENANT"
      | "PENDING_TENANT"
      | "UPGRADABLE_CUSTOMER"
      | "BLOCKED_EXISTING_ACCOUNT";

    let classification: Classification;

    if (hasWorkspace) {
      classification = "ACTIVE_TENANT";
    } else if (hasTenantRole) {
      classification = "PENDING_TENANT";
    } else if (hasCustomerRole && !hasTenantRole) {
      classification = "UPGRADABLE_CUSTOMER";
    } else {
      classification = "BLOCKED_EXISTING_ACCOUNT";
    }

    // ACTIVE_TENANT / BLOCKED — no mutation, no email
    if (
      classification === "ACTIVE_TENANT" ||
      classification === "BLOCKED_EXISTING_ACCOUNT"
    ) {
      return jsonResponse({ status: "email_taken" });
    }

    // ── UPGRADABLE_CUSTOMER — add tenant role + mark needs_password ──
    if (classification === "UPGRADABLE_CUSTOMER") {
      await admin
        .from("user_roles")
        .upsert(
          { user_id: userId, role: "tenant" },
          { onConflict: "user_id,role", ignoreDuplicates: true },
        );

      await admin.auth.admin.updateUserById(userId, {
        user_metadata: { needs_password: true },
      });
    }

    // ── PENDING_TENANT / UPGRADABLE_CUSTOMER — send access email ──

    // 1. Generate magic link
    const { data: linkData, error: linkError } =
      await admin.auth.admin.generateLink({
        type: "magiclink",
        email,
        options: { redirectTo: `${siteUrl}/admin` },
      });

    if (linkError) {
      console.error("creator-signup-start: generateLink error:", linkError);
      return jsonResponse({ error: "Temporarily unavailable", code: "temporary_unavailable", error_code: "TEMPORARY_UNAVAILABLE" }, 500);
    }

    // 2. Resolve language and build email
    const lang = await resolveUserLanguage(admin, userId, language);
    const t = getEmailTranslations(lang);

    const { data: profile } = await admin
      .from("profiles")
      .select("name")
      .eq("user_id", userId)
      .maybeSingle();

    const userName = profile?.name || name || "";
    const actionLink = linkData.properties.action_link;
    const html = buildCreatorWelcomeEmail(lang, userName, actionLink);

    // 3. Send + log via shared helper
    if (!resendApiKey) {
      console.error("creator-signup-start: RESEND_API_KEY not set");
      return jsonResponse({ error: "Email send failed", code: "email_send_failed", error_code: "EMAIL_SEND_FAILED" }, 500);
    }

    const result = await sendAndLogEmail({
      resendApiKey,
      supabaseAdmin: admin,
      senderName: "Hubfy",
      to: email,
      subject: t.creatorWelcome.subject,
      html,
      tenantId: null,
      emailType: "creator_welcome",
      userId,
      metadata: { flow: "creator_signup", classification },
    });

    if (!result.ok) {
      return jsonResponse({ error: "Email send failed", code: "email_send_failed", error_code: "EMAIL_SEND_FAILED" }, 500);
    }

    console.log(
      `creator-signup-start: ${classification} email sent to ${email} (resend_id=${result.resendMessageId})`,
    );

    return jsonResponse({ status: "check_email" });
  } catch (error) {
    console.error("creator-signup-start: unexpected error:", error);
    return jsonResponse({ error: "Temporarily unavailable", code: "temporary_unavailable", error_code: "TEMPORARY_UNAVAILABLE" }, 500);
  }
});
