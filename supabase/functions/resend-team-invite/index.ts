import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { authenticateRequest, authorizeWorkspace, toErrorResponse } from "../_shared/auth.ts";
import { resolvePublicSiteUrl } from "../_shared/site-url.ts";
import { sendAndLogEmail } from "../_shared/send-email.ts";
import { type EmailLanguage, resolveEmailLanguage } from "../_shared/email-i18n.ts";
import { buildTeamInviteEmail } from "../_shared/email-templates.ts";
import { getEmailTranslations } from "../_shared/email-i18n.ts";

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
    // 1. Auth
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY") || "";

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const identity = await authenticateRequest(req, supabaseAdmin);

    // 2. Parse body
    const { tenant_id, user_id, origin } = await req.json();
    const siteUrl = resolvePublicSiteUrl(origin);

    if (!tenant_id || typeof tenant_id !== "string") {
      return jsonResponse({ error: "tenant_id is required", code: "missing_required_field" }, 400);
    }
    if (!user_id || typeof user_id !== "string") {
      return jsonResponse({ error: "user_id is required", code: "missing_required_field" }, 400);
    }

    // 3. Validate caller is owner of the tenant
    await authorizeWorkspace(identity, tenant_id, supabaseAdmin, { minRole: "owner" });

    // 4. Verify member exists and is pending
    const { data: member, error: memberError } = await supabaseAdmin
      .from("tenant_users")
      .select("user_id, role, status")
      .eq("tenant_id", tenant_id)
      .eq("user_id", user_id)
      .single();

    if (memberError || !member) {
      return jsonResponse({ error: "Member not found", code: "member_not_found" }, 404);
    }

    if (member.status !== "pending") {
      return jsonResponse({ error: "This member already accepted the invitation", code: "invite_already_accepted" }, 400);
    }

    // 5. Get user email + language from auth
    const { data: authUser, error: authUserError } =
      await supabaseAdmin.auth.admin.getUserById(user_id);

    if (authUserError || !authUser?.user?.email) {
      return jsonResponse({ error: "User not found", code: "user_not_found" }, 404);
    }

    const memberEmail = authUser.user.email;
    const memberName = (authUser.user.user_metadata?.name as string) || "";

    // Resolve language from member's metadata + profile
    let lang: EmailLanguage = resolveEmailLanguage(authUser.user.user_metadata);
    if (!authUser.user.user_metadata?.language) {
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("preferences")
        .eq("user_id", user_id)
        .maybeSingle();
      lang = resolveEmailLanguage(
        authUser.user.user_metadata,
        profile?.preferences as Record<string, unknown> | null,
      );
    }

    // 6. Fetch tenant data for email branding
    const { data: tenantRaw } = await supabaseAdmin
      .from("tenants")
      .select("name, slug, tenant_settings(email_sender_name)")
      .eq("id", tenant_id)
      .single();

    const ts = tenantRaw?.tenant_settings ?? {};
    const tenantName = tenantRaw?.name || "Workspace";
    const senderName = ts.email_sender_name || tenantName;

    if (!resendApiKey) {
      return jsonResponse({ error: "Email not configured", code: "missing_resend_mkt_api_key" }, 500);
    }

    // 7. Generate new invite link
    const redirectTo = `${siteUrl}/admin/accept-invite`;

    const { data: linkData, error: linkErr } =
      await supabaseAdmin.auth.admin.generateLink({
        type: "magiclink",
        email: memberEmail,
        options: { redirectTo },
      });

    if (linkErr || !linkData?.properties?.action_link) {
      console.error("resend-team-invite: magic link error:", linkErr);
      return jsonResponse({ error: "Failed to generate invite link", code: "internal_error" }, 500);
    }

    // 8. Send invite email with i18n
    const t = getEmailTranslations(lang);
    const html = buildTeamInviteEmail(
      lang,
      memberName,
      tenantName,
      linkData.properties.action_link,
      member.role as "owner" | "editor",
    );

    const emailResult = await sendAndLogEmail({
      resendApiKey,
      supabaseAdmin: supabaseAdmin,
      senderName,
      to: memberEmail,
      subject: t.teamInvite.subject(tenantName),
      html,
      tenantId: tenant_id,
      emailType: "team_invite",
      userId: user_id,
    });

    if (!emailResult.ok) {
      console.error("resend-team-invite: email error:", emailResult.error);
      return jsonResponse({ error: "Failed to send email", code: "email_send_failed" }, 500);
    }

    return jsonResponse({ success: true });
  } catch (error: unknown) {
    console.error("resend-team-invite error:", error);
    return toErrorResponse(error, corsHeaders);
  }
});
