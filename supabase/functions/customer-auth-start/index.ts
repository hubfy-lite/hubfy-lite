import { createClient } from "jsr:@supabase/supabase-js@2";
import { resolvePublicSiteUrl } from "../_shared/site-url.ts";
import { sendAndLogEmail } from "../_shared/send-email.ts";
import { type EmailLanguage, resolveEmailLanguage, getEmailTranslations } from "../_shared/email-i18n.ts";
import { buildPortalAccessEmail } from "../_shared/email-templates.ts";

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

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed", code: "method_not_allowed" }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const admin = createClient(supabaseUrl, supabaseServiceKey);

    // ─── Detectar modo: AUTO (service_role) vs MANUAL (público) ───
    const authHeader = req.headers.get("Authorization");
    const bearerToken = authHeader?.startsWith("Bearer ")
      ? authHeader.replace("Bearer ", "")
      : "";

    const isAutoMode = bearerToken === supabaseServiceKey;

    if (isAutoMode) {
      return await handleAutoMode(admin, req, supabaseUrl, supabaseServiceKey, resendApiKey);
    } else {
      return await handleManualMode(admin, req, supabaseUrl, supabaseServiceKey, resendApiKey);
    }
  } catch (error: unknown) {
    console.error("customer-auth-start error:", error);
    return jsonResponse(
      {
        error: error instanceof Error ? error.message : "Internal error",
        code: "internal_error",
      },
      500,
    );
  }
});

/* ─── Resolve language for a customer ─── */

async function resolveCustomerLanguage(
  admin: ReturnType<typeof createClient>,
  userId: string | null,
): Promise<EmailLanguage> {
  if (!userId) return "pt-BR";

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

/* ═══════════════════════════════════════════════════════
   MODO AUTO — chamado por webhooks com service_role
   Input: { customer_id, tenant_id }
   ═══════════════════════════════════════════════════════ */

async function handleAutoMode(
  admin: ReturnType<typeof createClient>,
  req: Request,
  supabaseUrl: string,
  supabaseServiceKey: string,
  resendApiKey: string | undefined,
) {
  const { customer_id, tenant_id, order_id } = await req.json();

  if (!customer_id || !tenant_id) {
    return jsonResponse({ error: "customer_id and tenant_id are required", code: "missing_required_field" }, 400);
  }

  // Buscar customer
  const { data: customer } = await admin
    .from("customers")
    .select("id, email, name, user_id")
    .eq("id", customer_id)
    .single();

  if (!customer) {
    return jsonResponse({ error: "Customer not found", code: "customer_not_found" }, 404);
  }

  if (!customer.user_id) {
    return jsonResponse({ skipped: true, reason: "no_auth_user" });
  }

  // Buscar tenant + settings
  const { data: tenantRaw } = await admin
    .from("tenants")
    .select("name, slug, tenant_settings(icon_url, email_sender_name, enable_sale_emails)")
    .eq("id", tenant_id)
    .single();

  if (!tenantRaw) {
    return jsonResponse({ error: "Tenant not found", code: "tenant_not_found" }, 404);
  }

  const ts = (tenantRaw as Record<string, unknown>).tenant_settings as Record<string, unknown> ?? {};
  const tenant = { ...tenantRaw, ...ts } as {
    name: string;
    slug: string;
    icon_url?: string | null;
    email_sender_name?: string | null;
    enable_sale_emails?: boolean;
  };

  // Check: sale emails toggle
  if (tenant.enable_sale_emails === false) {
    try {
      await admin.from("email_logs").insert({
        tenant_id: tenant_id,
        customer_id: customer_id,
        order_id: order_id || null,
        user_id: customer.user_id || null,
        recipient_email: customer.email,
        subject: `Seu link de acesso — ${tenant.name}`,
        email_type: "reconciliation",
        status: "skipped",
        error_message: "sale_emails_disabled",
        metadata: { reason: "tenant_setting" },
      });
    } catch (logErr) {
      console.error("customer-auth-start: log insert error (skipped):", logErr);
    }
    return jsonResponse({ skipped: true, reason: "sale_emails_disabled" });
  }

  if (!resendApiKey) {
    console.error("customer-auth-start: RESEND_API_KEY não configurada");
    return jsonResponse({ error: "RESEND_API_KEY not configured", code: "missing_resend_mkt_api_key" }, 500);
  }

  // Resolve language
  const lang = await resolveCustomerLanguage(admin, customer.user_id);
  const t = getEmailTranslations(lang);

  // Gerar magic link
  const siteUrl = resolvePublicSiteUrl(null);
  const redirectTo = `${siteUrl}/${tenant.slug}`;

  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: customer.email,
    options: { redirectTo },
  });

  if (linkErr || !linkData?.properties?.action_link) {
    console.error("customer-auth-start: magic link error:", linkErr);
    return jsonResponse({ error: "Failed to generate access link", code: "internal_error" }, 500);
  }

  // Enviar email via Resend
  const senderName = tenant.email_sender_name || tenant.name;
  const customerName = customer.name || customer.email.split("@")[0];
  const portalLoginUrl = `${siteUrl}/${tenant.slug}/login`;

  const emailHtml = buildPortalAccessEmail(
    lang,
    customerName,
    tenant.name,
    tenant.icon_url || null,
    linkData.properties.action_link,
    portalLoginUrl,
  );

  const emailResult = await sendAndLogEmail({
    resendApiKey: resendApiKey!,
    supabaseAdmin: admin,
    senderName,
    to: customer.email,
    subject: t.portalAccess.subject(tenant.name),
    html: emailHtml,
    tenantId: tenant_id,
    emailType: "reconciliation",
    customerId: customer_id,
    orderId: order_id || undefined,
    userId: customer.user_id,
  });

  if (!emailResult.ok) {
    return jsonResponse({ error: "Failed to send email", code: "email_send_failed" }, 500);
  }

  return jsonResponse({ success: true, resend_message_id: emailResult.resendMessageId });
}

/* ═══════════════════════════════════════════════════════
   MODO MANUAL — chamado pelo portal login (público)
   Input: { tenant_slug, email, redirect_origin }
   ═══════════════════════════════════════════════════════ */

async function handleManualMode(
  admin: ReturnType<typeof createClient>,
  req: Request,
  supabaseUrl: string,
  supabaseServiceKey: string,
  resendApiKey: string | undefined,
) {
  const { tenant_slug, email, redirect_origin } = await req.json();

  if (!tenant_slug || !email) {
    return jsonResponse({ error: "tenant_slug and email are required", code: "missing_required_field" }, 400);
  }

  const normalizedEmail = email.trim().toLowerCase();

  // Extrair IP para rate limiting
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";

  // Buscar tenant
  const { data: tenantRaw } = await admin
    .from("tenants")
    .select("id, name, slug, tenant_settings(icon_url, email_sender_name)")
    .eq("slug", tenant_slug)
    .single();

  if (!tenantRaw) {
    return jsonResponse({ success: true });
  }

  const ts = (tenantRaw as Record<string, unknown>).tenant_settings as Record<string, unknown> ?? {};
  const tenant = { ...tenantRaw, ...ts } as {
    id: string;
    name: string;
    slug: string;
    icon_url?: string | null;
    email_sender_name?: string | null;
  };

  // ── Rate limiting ──

  const { data: recentByEmail } = await admin
    .from("portal_auth_requests")
    .select("id")
    .eq("tenant_id", tenant.id)
    .eq("email", normalizedEmail)
    .gte("created_at", new Date(Date.now() - 60_000).toISOString())
    .limit(1);

  if (recentByEmail && recentByEmail.length > 0) {
    return jsonResponse({ success: true });
  }

  const { data: recentByIp } = await admin
    .from("portal_auth_requests")
    .select("id")
    .eq("ip_address", ip)
    .gte("created_at", new Date(Date.now() - 300_000).toISOString())
    .limit(6);

  if (recentByIp && recentByIp.length >= 5) {
    return jsonResponse({ error: "Too many attempts. Please try again in a few minutes.", code: "rate_limited" }, 429);
  }

  // Registrar request
  await admin
    .from("portal_auth_requests")
    .insert({ tenant_id: tenant.id, email: normalizedEmail, ip_address: ip });

  // Cleanup probabilístico (1 em 10 requests)
  if (Math.random() < 0.1) {
    admin
      .from("portal_auth_requests")
      .delete()
      .lt("created_at", new Date(Date.now() - 3600_000).toISOString())
      .then(() => {})
      .catch(() => {});
  }

  // ── Verificar customer ──
  const { data: customer } = await admin
    .from("customers")
    .select("id, email, name, user_id")
    .eq("tenant_id", tenant.id)
    .eq("email", normalizedEmail)
    .maybeSingle();

  if (!customer) {
    return jsonResponse({ success: true });
  }

  // ── Garantir auth.user ──
  let authUserId = customer.user_id;

  if (!authUserId) {
    const customerName = customer.name || normalizedEmail;
    const randomPassword = crypto.randomUUID() + "Aa1!";

    const { data: newUser, error: createErr } = await admin.auth.admin.createUser({
      email: normalizedEmail,
      email_confirm: true,
      password: randomPassword,
      user_metadata: {
        name: customerName,
        signup_as: "customer",
        customer_tenant_id: tenant.id,
      },
    });

    if (createErr) {
      const errMsg = createErr.message || "";
      if (
        errMsg.includes("already been registered") ||
        errMsg.includes("already exists") ||
        errMsg.includes("duplicate")
      ) {
        try {
          const resp = await fetch(
            `${supabaseUrl}/auth/v1/admin/users?page=1&per_page=1&filter=${encodeURIComponent(normalizedEmail)}`,
            {
              headers: {
                Authorization: `Bearer ${supabaseServiceKey}`,
                apikey: supabaseServiceKey,
              },
            },
          );
          if (resp.ok) {
            const { users } = await resp.json();
            const found = (users as Array<{ id: string; email?: string }>)?.find(
              (u) => u.email?.toLowerCase() === normalizedEmail,
            );
            if (found) authUserId = found.id;
          }
        } catch (e) {
          console.warn("customer-auth-start: erro ao buscar auth user:", e);
        }
      } else {
        console.error("customer-auth-start: erro ao criar auth user:", createErr);
        return jsonResponse({ success: true });
      }
    } else {
      authUserId = newUser?.user?.id ?? null;
    }

    if (authUserId) {
      await admin
        .from("customers")
        .update({ user_id: authUserId })
        .eq("id", customer.id);
    }
  }

  if (!authUserId) {
    return jsonResponse({ success: true });
  }

  if (!resendApiKey) {
    console.error("customer-auth-start: RESEND_API_KEY não configurada");
    return jsonResponse({ success: true });
  }

  // Resolve language
  const lang = await resolveCustomerLanguage(admin, authUserId);
  const t = getEmailTranslations(lang);

  // ── Gerar magic link ──
  const siteUrl = resolvePublicSiteUrl(redirect_origin);
  const redirectTo = `${siteUrl}/${tenant.slug}`;

  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: normalizedEmail,
    options: { redirectTo },
  });

  if (linkErr || !linkData?.properties?.action_link) {
    console.error("customer-auth-start: magic link error:", linkErr);
    return jsonResponse({ success: true });
  }

  // ── Enviar email ──
  const senderName = tenant.email_sender_name || tenant.name;
  const customerName = customer.name || normalizedEmail.split("@")[0];
  const portalLoginUrl = `${siteUrl}/${tenant.slug}/login`;

  const emailHtml = buildPortalAccessEmail(
    lang,
    customerName,
    tenant.name,
    tenant.icon_url || null,
    linkData.properties.action_link,
    portalLoginUrl,
  );

  const emailResult = await sendAndLogEmail({
    resendApiKey: resendApiKey!,
    supabaseAdmin: admin,
    senderName,
    to: normalizedEmail,
    subject: t.portalAccess.subject(tenant.name),
    html: emailHtml,
    tenantId: tenant.id,
    emailType: "portal_access",
    customerId: customer.id,
    userId: authUserId || undefined,
  });

  if (!emailResult.ok) {
    console.error("customer-auth-start: email error:", emailResult.error);
  }

  return jsonResponse({ success: true });
}
