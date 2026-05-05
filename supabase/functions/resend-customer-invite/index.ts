import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { authenticateRequest, authorizeWorkspace, toErrorResponse } from "../_shared/auth.ts";
import { resolvePublicSiteUrl } from "../_shared/site-url.ts";
import { sendAndLogEmail } from "../_shared/send-email.ts";
import { type EmailLanguage, resolveEmailLanguage, getEmailTranslations } from "../_shared/email-i18n.ts";
import { buildCustomerInviteEmail, buildCustomerAccessEmail } from "../_shared/email-templates.ts";

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

/* ─── Handler ─── */

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY") || "";

    // ── 1. Admin client ──
    const admin = createClient(supabaseUrl, supabaseServiceKey);

    // ── 2. Authenticate (who are you?) ──
    const identity = await authenticateRequest(req, admin);

    // ── 3. Parse body ──
    const { customer_id, origin } = await req.json();
    if (!customer_id || typeof customer_id !== "string") {
      return jsonResponse({ error: "customer_id is required", code: "missing_required_field" }, 400);
    }

    const siteUrl = resolvePublicSiteUrl(origin);

    // ── 4. Load resource to discover tenant_id ──
    const { data: customer, error: customerError } = await admin
      .from("customers")
      .select("id, user_id, email, name, tenant_id")
      .eq("id", customer_id)
      .single();

    if (customerError || !customer) {
      return jsonResponse({ error: "Customer not found", code: "customer_not_found" }, 404);
    }

    // ── 5. Authorize workspace ──
    const auth = await authorizeWorkspace(identity, customer.tenant_id, admin, { minRole: "owner" });

    // ── 6. Fetch tenant data for email branding ──
    const { data: tenantRaw } = await admin
      .from("tenants")
      .select("name, slug, tenant_settings(icon_url, email_sender_name)")
      .eq("id", customer.tenant_id)
      .single();

    const ts = tenantRaw?.tenant_settings ?? {};
    const tenantName = tenantRaw?.name || "Portal";
    const tenantSlug = tenantRaw?.slug || "";
    const tenantLogoUrl = ts.icon_url || null;
    const senderName = ts.email_sender_name || tenantName;

    if (!resendApiKey) {
      return jsonResponse({ error: "Email not configured", code: "missing_resend_mkt_api_key" }, 500);
    }

    // ── 7. Get auth user + resolve language ──
    const { data: authUser, error: authUserError } =
      await admin.auth.admin.getUserById(customer.user_id);

    if (authUserError || !authUser?.user) {
      return jsonResponse({ error: "Auth user not found", code: "user_not_found" }, 404);
    }

    let lang: EmailLanguage = resolveEmailLanguage(authUser.user.user_metadata);
    if (!authUser.user.user_metadata?.language) {
      const { data: profile } = await admin
        .from("profiles")
        .select("preferences")
        .eq("user_id", customer.user_id)
        .maybeSingle();
      lang = resolveEmailLanguage(
        authUser.user.user_metadata,
        profile?.preferences as Record<string, unknown> | null,
      );
    }

    const t = getEmailTranslations(lang);
    let emailSent = false;

    if (!authUser.user.email_confirmed_at) {
      // User never logged in → re-generate invite link and send invite email
      const { data: linkData, error: linkError } =
        await admin.auth.admin.generateLink({
          type: "invite",
          email: customer.email,
          options: {
            data: {
              name: customer.name,
              signup_as: "customer",
              customer_tenant_id: customer.tenant_id,
            },
            redirectTo: `${siteUrl}/${tenantSlug}/portal`,
          },
        });

      if (linkError) {
        console.error("generateLink error:", linkError);
        return jsonResponse(
          { error: "Failed to generate invite link: " + linkError.message, code: "internal_error" },
          500
        );
      }

      const inviteLink = linkData.properties.action_link;
      const html = buildCustomerInviteEmail(
        lang,
        customer.name,
        tenantName,
        tenantLogoUrl,
        inviteLink,
      );

      const emailResult = await sendAndLogEmail({
        resendApiKey,
        supabaseAdmin: admin,
        senderName,
        to: customer.email,
        subject: t.customerInvite.subject(tenantName),
        html,
        tenantId: customer.tenant_id,
        emailType: "customer_invite",
        customerId: customer.id,
        userId: customer.user_id,
      });

      emailSent = emailResult.ok;
      if (!emailResult.ok) {
        console.error("Failed to send invite email:", emailResult.error);
        return jsonResponse({ error: "Failed to send email: " + emailResult.error, code: "email_send_failed" }, 500);
      }
    } else {
      // User already confirmed → send "access granted" email with login link
      const loginLink = `${siteUrl}/${tenantSlug}/login`;
      const html = buildCustomerAccessEmail(
        lang,
        customer.name,
        tenantName,
        tenantLogoUrl,
        loginLink,
      );

      const emailResult = await sendAndLogEmail({
        resendApiKey,
        supabaseAdmin: admin,
        senderName,
        to: customer.email,
        subject: t.customerAccess.subject(tenantName),
        html,
        tenantId: customer.tenant_id,
        emailType: "access_granted",
        customerId: customer.id,
        userId: customer.user_id,
      });

      emailSent = emailResult.ok;
      if (!emailResult.ok) {
        console.error("Failed to send access-granted email:", emailResult.error);
        return jsonResponse({ error: "Failed to send email: " + emailResult.error, code: "email_send_failed" }, 500);
      }
    }

    return jsonResponse({
      success: true,
      email_sent: emailSent,
    });
  } catch (error: unknown) {
    console.error("resend-customer-invite error:", error);
    return toErrorResponse(error, corsHeaders);
  }
});
