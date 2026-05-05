import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { authenticateRequest, authorizeWorkspace, toErrorResponse } from "../_shared/auth.ts";
import { resolvePublicSiteUrl } from "../_shared/site-url.ts";
import { type EmailLanguage, resolveEmailLanguage, getEmailTranslations } from "../_shared/email-i18n.ts";
import { buildTeamInviteEmail, buildTeamAccessEmail } from "../_shared/email-templates.ts";
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

/* ─── Resolve language for a user ─── */

async function resolveUserLanguage(
  admin: ReturnType<typeof createClient>,
  userId: string,
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

    return resolveEmailLanguage(meta, profile?.preferences as Record<string, unknown> | null);
  } catch {
    return "pt-BR";
  }
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
    const { tenant_id, email, role: requestedRole, origin } = await req.json();

    const siteUrl = resolvePublicSiteUrl(origin);
    if (!tenant_id || typeof tenant_id !== "string") {
      return jsonResponse({ error: "tenant_id is required", code: "missing_required_field" }, 400);
    }
    if (!email || typeof email !== "string") {
      return jsonResponse({ error: "Email is required", code: "missing_required_field" }, 400);
    }

    const auth = await authorizeWorkspace(identity, tenant_id, supabaseAdmin, { minRole: "owner" });
    const callerId = auth.userId;
    const tenantId = auth.tenantId;

    const normalizedEmail = email.trim().toLowerCase();
    const memberRole: "owner" | "editor" = requestedRole === "owner" ? "owner" : "editor";

    // 4. Fetch tenant data for email branding
    const { data: tenantRaw } = await supabaseAdmin
      .from("tenants")
      .select("name, slug, tenant_settings(icon_url, email_sender_name)")
      .eq("id", tenantId)
      .single();

    const ts = tenantRaw?.tenant_settings ?? {};
    const tenantName = tenantRaw?.name || "Workspace";
    const senderName = ts.email_sender_name || tenantName;

    // 5. Try to find or create the user
    let memberUserId: string;
    let isNewUser = false;
    let emailSent = false;

    // Try generateLink (invite) — creates user if new
    const { data: linkData, error: linkError } =
      await supabaseAdmin.auth.admin.generateLink({
        type: "invite",
        email: normalizedEmail,
        options: {
          data: {
            signup_as: "team_member",
            team_member_tenant_id: tenantId,
          },
          redirectTo: `${siteUrl}/admin/accept-invite`,
        },
      });

    if (linkError) {
      const errStatus = (linkError as any).status;
      const errCode: string = (linkError as any).code || "";

      // Rate limit → 429
      if (
        errStatus === 429 ||
        errCode === "over_request_rate_limit" ||
        errCode === "over_email_send_rate_limit"
      ) {
        return jsonResponse(
          { success: false, code: "rate_limited", email_sent: false, error: "Too many attempts. Please wait and try again." },
          429,
        );
      }

      // User already exists → look up by email
      const isUserExists =
        errStatus === 422 ||
        errStatus === 409 ||
        ["email_exists", "user_already_exists", "identity_already_exists", "conflict"].includes(errCode) ||
        (linkError.message || "").toLowerCase().includes("already");

      if (!isUserExists) {
        console.error("generateLink unexpected error:", { status: errStatus, code: errCode, message: linkError.message });
        throw linkError;
      }

      // Buscar usuário existente por email via RPC
      const { data: foundUserId, error: lookupError } = await supabaseAdmin
        .rpc("get_user_id_by_email", { p_email: normalizedEmail });

      if (lookupError || !foundUserId) {
        console.error("get_user_id_by_email failed:", lookupError);
        return jsonResponse({ error: "User exists but could not be found", code: "user_not_found" }, 500);
      }

      memberUserId = foundUserId;

      // Guard: cannot invite yourself (by user_id — covers email-changed edge case)
      if (memberUserId === callerId) {
        return jsonResponse(
          { success: false, code: "cannot_invite_self", email_sent: false, error: "You are already a member of this workspace" },
          400,
        );
      }

      // Check if already a member of this tenant
      const { data: alreadyMember } = await supabaseAdmin
        .from("tenant_users")
        .select("user_id")
        .eq("tenant_id", tenantId)
        .eq("user_id", memberUserId)
        .maybeSingle();

      if (alreadyMember) {
        return jsonResponse(
          { success: false, code: "already_member", email_sent: false, error: "This email is already a member of this workspace" },
          409,
        );
      }

      // Add existing user to tenant_users
      const { error: insertError } = await supabaseAdmin
        .from("tenant_users")
        .insert({
          tenant_id: tenantId,
          user_id: memberUserId,
          role: memberRole,
          status: "active",
        });

      if (insertError) {
        if (
          insertError.message?.includes("unique") ||
          insertError.message?.includes("duplicate")
        ) {
          return jsonResponse(
            { success: false, code: "already_member", email_sent: false, error: "This email is already a member of this workspace" },
            409,
          );
        }
        throw insertError;
      }

      // Ensure user has tenant role
      await supabaseAdmin
        .from("user_roles")
        .upsert(
          { user_id: memberUserId, role: "tenant" },
          { onConflict: "user_id,role", ignoreDuplicates: true }
        );

      // Resolve language and send "access granted" email
      if (resendApiKey) {
        const lang = await resolveUserLanguage(supabaseAdmin, memberUserId);
        const t = getEmailTranslations(lang);

        const memberProfile = await supabaseAdmin
          .from("profiles")
          .select("name")
          .eq("user_id", memberUserId)
          .maybeSingle();

        const memberName = memberProfile?.data?.name || "";
        const loginLink = `${siteUrl}/admin`;
        const html = buildTeamAccessEmail(
          lang,
          memberName,
          tenantName,
          loginLink,
          memberRole,
        );

        const emailResult = await sendAndLogEmail({
          resendApiKey,
          supabaseAdmin,
          senderName,
          to: normalizedEmail,
          subject: t.teamAccess.subject(tenantName),
          html,
          tenantId,
          emailType: "access_granted",
          userId: memberUserId,
        });

        emailSent = emailResult.ok;
        if (!emailResult.ok) {
          console.error("Failed to send access email:", emailResult.error);
        }
      }
    } else {
      // New user created via invite
      memberUserId = linkData.user.id;
      isNewUser = true;

      // Fix role + mark as pending
      await supabaseAdmin
        .from("tenant_users")
        .update({ role: memberRole, status: "pending" })
        .eq("tenant_id", tenantId)
        .eq("user_id", memberUserId);

      // Send invite email (new user — default to caller's language or pt-BR)
      if (resendApiKey) {
        // New user has no language preference yet — use caller's language
        const callerLang = await resolveUserLanguage(supabaseAdmin, callerId);
        const t = getEmailTranslations(callerLang);

        const inviteLink = linkData.properties.action_link;
        const html = buildTeamInviteEmail(
          callerLang,
          "",
          tenantName,
          inviteLink,
          memberRole,
        );

        const emailResult = await sendAndLogEmail({
          resendApiKey,
          supabaseAdmin,
          senderName,
          to: normalizedEmail,
          subject: t.teamInvite.subject(tenantName),
          html,
          tenantId,
          emailType: "team_invite",
          userId: memberUserId,
        });

        emailSent = emailResult.ok;
        if (!emailResult.ok) {
          console.error("Failed to send invite email:", emailResult.error);
        }
      }
    }

    return jsonResponse({
      success: true,
      code: isNewUser ? "invited" : "access_granted",
      email_sent: emailSent,
      message: isNewUser ? "Invitation sent" : "Access granted",
      member: {
        user_id: memberUserId,
        email: normalizedEmail,
        role: memberRole,
        is_new_user: isNewUser,
      },
    });
  } catch (error: unknown) {
    console.error("add-team-member error:", error);
    return toErrorResponse(error, corsHeaders);
  }
});
