import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { authenticateRequest, authorizeWorkspace, toErrorResponse } from "../_shared/auth.ts";
import { resolvePublicSiteUrl } from "../_shared/site-url.ts";

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

const VALID_DOCUMENT_TYPES = [
  "CPF",
  "CNPJ",
  "PASSPORT",
  "DNI",
  "ID",
  "RUT",
  "EIN",
  "VAT",
] as const;

/* ─── Email templates ─── */

function buildInviteEmailHtml(params: {
  customerName: string;
  tenantName: string;
  tenantLogoUrl: string | null;
  inviteLink: string;
}): string {
  const { customerName, tenantName, tenantLogoUrl, inviteLink } = params;

  const logoBlock = tenantLogoUrl
    ? `<img src="${tenantLogoUrl}" alt="${tenantName}" width="48" height="48" style="display: block; width: 48px; height: 48px; border-radius: 8px; object-fit: cover; background-color: #f5f5f5; margin: 0 0 24px 0;" />`
    : `<p style="font-size: 18px; font-weight: 600; color: #1a1a1a; margin-bottom: 24px;">${tenantName}</p>`;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Convite para o portal</title>
</head>
<body style="margin: 0; padding: 0; background-color: #ffffff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
    <tr>
      <td>
        ${logoBlock}

        <p style="font-size: 16px; font-weight: 700; color: #1a1a1a; margin: 0 0 12px 0;">Olá, ${customerName}!</p>

        <p style="font-size: 16px; color: #1a1a1a; margin: 0 0 12px 0; line-height: 1.5;">
          Você foi convidado para acessar o portal de <strong>${tenantName}</strong>.
        </p>

        <p style="font-size: 16px; color: #1a1a1a; margin: 0 0 24px 0; line-height: 1.5;">
          Clique no botão abaixo para definir sua senha e acessar seus conteúdos.
        </p>

        <a href="${inviteLink}" style="display: inline-block; background-color: #1a1a1a; color: #ffffff; font-size: 14px; font-weight: 600; text-decoration: none; padding: 12px 24px; border-radius: 9999px; margin: 0 0 32px 0;">
          Acessar portal
        </a>

        <p style="font-size: 14px; color: #999999; margin: 0 0 48px 0; line-height: 1.5;">
          Se você não esperava este email, pode ignorá-lo com segurança.
        </p>

        <hr style="border: none; border-top: 1px solid #eeeeee; margin: 0 0 24px 0;">

        <p style="font-size: 16px; font-weight: 700; color: #1a1a1a; margin: 0;">
          ${tenantName} <span style="font-weight: 400; color: #999999; font-size: 14px;">via</span> <a href="${resolvePublicSiteUrl(null)}" style="text-decoration: none; color: #1a1a1a;">Hubfy</a>
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function buildAccessGrantedEmailHtml(params: {
  customerName: string;
  tenantName: string;
  tenantLogoUrl: string | null;
  loginLink: string;
}): string {
  const { customerName, tenantName, tenantLogoUrl, loginLink } = params;

  const logoBlock = tenantLogoUrl
    ? `<img src="${tenantLogoUrl}" alt="${tenantName}" width="48" height="48" style="display: block; width: 48px; height: 48px; border-radius: 8px; object-fit: cover; background-color: #f5f5f5; margin: 0 0 24px 0;" />`
    : `<p style="font-size: 18px; font-weight: 600; color: #1a1a1a; margin-bottom: 24px;">${tenantName}</p>`;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Acesso ao portal</title>
</head>
<body style="margin: 0; padding: 0; background-color: #ffffff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
    <tr>
      <td>
        ${logoBlock}

        <p style="font-size: 16px; font-weight: 700; color: #1a1a1a; margin: 0 0 12px 0;">Olá, ${customerName}!</p>

        <p style="font-size: 16px; color: #1a1a1a; margin: 0 0 12px 0; line-height: 1.5;">
          Você agora tem acesso ao portal de <strong>${tenantName}</strong>.
        </p>

        <p style="font-size: 16px; color: #1a1a1a; margin: 0 0 24px 0; line-height: 1.5;">
          Use seu e-mail e senha para entrar e acessar seus conteúdos.
        </p>

        <a href="${loginLink}" style="display: inline-block; background-color: #1a1a1a; color: #ffffff; font-size: 14px; font-weight: 600; text-decoration: none; padding: 12px 24px; border-radius: 9999px; margin: 0 0 32px 0;">
          Acessar portal
        </a>

        <p style="font-size: 14px; color: #999999; margin: 0 0 48px 0; line-height: 1.5;">
          Se você não esperava este e-mail, pode ignorá-lo com segurança.
        </p>

        <hr style="border: none; border-top: 1px solid #eeeeee; margin: 0 0 24px 0;">

        <p style="font-size: 16px; font-weight: 700; color: #1a1a1a; margin: 0;">
          ${tenantName} <span style="font-weight: 400; color: #999999; font-size: 14px;">via</span> <a href="${resolvePublicSiteUrl(null)}" style="text-decoration: none; color: #1a1a1a;">Hubfy</a>
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

async function sendEmail(params: {
  resendApiKey: string;
  senderName: string;
  to: string;
  subject: string;
  html: string;
}): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: `${params.senderName} <${Deno.env.get("EMAIL_FROM_ADDRESS") ?? "noreply@notifications.example.com"}>`,
      to: [params.to],
      subject: params.subject,
      html: params.html,
    }),
  });

  if (res.ok) return { ok: true };

  const body = await res.json().catch(() => ({}));
  const error = body?.message || body?.error || "Erro ao enviar email";
  console.error("Resend error:", body);
  return { ok: false, error: typeof error === "string" ? error : JSON.stringify(error) };
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
    const {
      tenant_id,
      email,
      name,
      first_name,
      last_name,
      phone,
      country,
      city,
      region,
      document_type,
      document,
      origin,
    } = await req.json();

    const siteUrl = resolvePublicSiteUrl(origin);
    if (!tenant_id || typeof tenant_id !== "string") {
      return jsonResponse({ error: "tenant_id is required", code: "missing_required_field" }, 400);
    }
    if (!email || typeof email !== "string") {
      return jsonResponse({ error: "Email is required", code: "missing_required_field" }, 400);
    }

    const auth = await authorizeWorkspace(identity, tenant_id, supabaseAdmin, { minRole: "owner" });
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedFirstName = typeof first_name === "string" ? first_name.trim() : "";
    const normalizedLastName = typeof last_name === "string" ? last_name.trim() : "";
    const fullNameFromParts = [normalizedFirstName, normalizedLastName]
      .filter(Boolean)
      .join(" ")
      .trim();
    const fallbackName = typeof name === "string" ? name.trim() : "";
    const trimmedName = fullNameFromParts || fallbackName;
    const normalizedPhone = typeof phone === "string" ? phone.trim() : "";
    const normalizedCountry = typeof country === "string" ? country.trim() : "";
    const normalizedCity = typeof city === "string" ? city.trim() : "";
    const normalizedRegion = typeof region === "string" ? region.trim() : "";
    const rawDocumentType = typeof document_type === "string"
      ? document_type.trim().toUpperCase()
      : "";
    const normalizedDocumentType = rawDocumentType &&
      VALID_DOCUMENT_TYPES.includes(
        rawDocumentType as (typeof VALID_DOCUMENT_TYPES)[number],
      )
      ? rawDocumentType
      : "";
    const normalizedDocument = typeof document === "string" ? document.trim() : "";
    if (!trimmedName) {
      return jsonResponse({ error: "Name is required", code: "missing_required_field" }, 400);
    }

    const tenantId = auth.tenantId;

    // 4. Fetch tenant data for email branding
    const { data: tenantRaw } = await supabaseAdmin
      .from("tenants")
      .select("name, slug, tenant_settings(icon_url, email_sender_name)")
      .eq("id", tenantId)
      .single();

    const ts = tenantRaw?.tenant_settings ?? {};
    const tenantName = tenantRaw?.name || "Portal";
    const tenantSlug = tenantRaw?.slug || "";
    const tenantLogoUrl = ts.icon_url || null;
    const senderName = ts.email_sender_name || tenantName;

    // 5. Try to create user via invite link. If already exists, handle gracefully.
    let customerUserId: string;
    let isNewUser = false;
    let emailSent = false;

    // Try generateLink (invite) — creates user in auth.users + returns action_link
    const { data: linkData, error: linkError } =
      await supabaseAdmin.auth.admin.generateLink({
        type: "invite",
        email: normalizedEmail,
        options: {
          data: {
            name: trimmedName,
            signup_as: "customer",
            customer_tenant_id: tenantId,
          },
          redirectTo: `${siteUrl}/${tenantSlug}/portal`,
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
          { error: "Too many attempts. Please wait and try again.", code: "rate_limited" },
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

      // Buscar usuário existente por email via RPC (sem limite de 1000)
      const { data: foundUserId, error: lookupError } = await supabaseAdmin
        .rpc("get_user_id_by_email", { p_email: normalizedEmail });

      if (lookupError || !foundUserId) {
        console.error("get_user_id_by_email failed:", lookupError);
        return jsonResponse({ error: "User exists but could not be found", code: "user_not_found" }, 500);
      }

      customerUserId = foundUserId;

      // Check if already a customer of this tenant
      const { data: alreadyCustomer } = await supabaseAdmin
        .from("customers")
        .select("id")
        .eq("tenant_id", tenantId)
        .eq("user_id", customerUserId)
        .maybeSingle();

      if (alreadyCustomer) {
        return jsonResponse(
          { error: "This email is already a customer of this workspace", code: "customer_already_exists" },
          409
        );
      }

      // Add existing user to customers table
      const { error: insertError } = await supabaseAdmin
        .from("customers")
        .insert({
          tenant_id: tenantId,
          user_id: customerUserId,
          name: trimmedName,
          first_name: normalizedFirstName || null,
          last_name: normalizedLastName || null,
          email: normalizedEmail,
          phone: normalizedPhone || null,
          country: normalizedCountry || null,
          city: normalizedCity || null,
          region: normalizedRegion || null,
          document_type: normalizedDocumentType || null,
          document: normalizedDocument || null,
        });

      if (insertError) {
        if (
          insertError.message?.includes("unique") ||
          insertError.message?.includes("duplicate")
        ) {
          return jsonResponse(
            { error: "This email is already a customer of this workspace", code: "customer_already_exists" },
            409
          );
        }
        throw insertError;
      }

      // Ensure user has customer role in user_roles
      await supabaseAdmin
        .from("user_roles")
        .upsert(
          { user_id: customerUserId, role: "customer" },
          { onConflict: "user_id,role", ignoreDuplicates: true }
        );

      // Update profile name if needed
      await supabaseAdmin
        .from("profiles")
        .update({ name: trimmedName })
        .eq("user_id", customerUserId);

      // Send "access granted" email (existing user)
      if (resendApiKey && tenantSlug) {
        const loginLink = `${siteUrl}/${tenantSlug}/login`;
        const html = buildAccessGrantedEmailHtml({
          customerName: trimmedName,
          tenantName,
          tenantLogoUrl,
          loginLink,
        });

        const emailResult = await sendEmail({
          resendApiKey,
          senderName,
          to: normalizedEmail,
          subject: `Você tem acesso ao portal de ${tenantName}`,
          html,
        });

        emailSent = emailResult.ok;
        if (!emailResult.ok) {
          console.error("Failed to send access-granted email:", emailResult.error);
        }
      }
    } else {
      // New user created successfully via invite link
      customerUserId = linkData.user.id;
      isNewUser = true;

      // The handle_new_user trigger already created:
      // - profile (with name)
      // - user_roles (customer)
      // - customers (linked to tenant with name + email)
      // Now update identity/contact fields if provided
      if (
        normalizedFirstName ||
        normalizedLastName ||
        normalizedPhone ||
        normalizedCountry ||
        normalizedCity ||
        normalizedRegion ||
        normalizedDocumentType ||
        normalizedDocument
      ) {
        await supabaseAdmin
          .from("customers")
          .update({
            first_name: normalizedFirstName || null,
            last_name: normalizedLastName || null,
            phone: normalizedPhone || null,
            country: normalizedCountry || null,
            city: normalizedCity || null,
            region: normalizedRegion || null,
            document_type: normalizedDocumentType || null,
            document: normalizedDocument || null,
          })
          .eq("tenant_id", tenantId)
          .eq("user_id", customerUserId);
      }

      // Send invite email with link to set password
      if (resendApiKey) {
        const inviteLink = linkData.properties.action_link;
        const html = buildInviteEmailHtml({
          customerName: trimmedName,
          tenantName,
          tenantLogoUrl,
          inviteLink,
        });

        const emailResult = await sendEmail({
          resendApiKey,
          senderName,
          to: normalizedEmail,
          subject: `Convite para o portal de ${tenantName}`,
          html,
        });

        emailSent = emailResult.ok;
        if (!emailResult.ok) {
          console.error("Failed to send invite email:", emailResult.error);
        }
      }
    }

    return jsonResponse({
      success: true,
      customer: {
        user_id: customerUserId,
        email: normalizedEmail,
        name: trimmedName,
        is_new_user: isNewUser,
      },
      email_sent: emailSent,
    });
  } catch (error: unknown) {
    console.error("add-customer error:", error);
    return toErrorResponse(error, corsHeaders);
  }
});
