import { createClient } from "jsr:@supabase/supabase-js@2";

/* ─── Types ─── */

interface ReconcileRequest {
  order_id: string;
  trigger_source?: "checkout" | "hotmart" | "admin_button" | "reprocess";
  force_resend_email?: boolean;
}

interface RpcResult {
  status: "ok" | "needs_auth_user" | "error";
  customer_id?: string;
  user_id?: string | null;
  customer_email?: string;
  customer_name?: string;
  product_has_courses?: boolean;
  courses_granted?: number;
  courses_already_had?: number;
  courses_revoked?: number;
  error_message?: string | null;
  note?: string;
}

/* ─── Auth helper ─── */

function getJwtRole(authHeader: string | null): string | null {
  try {
    const token = authHeader?.startsWith("Bearer ")
      ? authHeader.slice(7)
      : "";
    if (!token) return null;
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = JSON.parse(atob(parts[1]));
    return payload?.role ?? null;
  } catch {
    return null;
  }
}

function getHeaderToken(value: string | null): string {
  if (!value) return "";
  return value.startsWith("Bearer ")
    ? value.slice(7)
    : value.trim();
}

async function isServiceRoleRequest(
  supabaseUrl: string,
  supabaseServiceKey: string,
  authHeader: string | null,
  apiKeyHeader: string | null,
): Promise<boolean> {
  const bearerToken = getHeaderToken(authHeader);
  const headerApiKey = getHeaderToken(apiKeyHeader);
  const jwtRole = getJwtRole(authHeader);

  if (
    bearerToken === supabaseServiceKey ||
    headerApiKey === supabaseServiceKey ||
    jwtRole === "service_role"
  ) {
    return true;
  }

  const candidateKey = bearerToken || headerApiKey;
  if (!candidateKey || !candidateKey.startsWith("sb_secret_")) {
    return false;
  }

  try {
    const probe = createClient(supabaseUrl, candidateKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
    const { error } = await probe.auth.admin.listUsers({
      page: 1,
      perPage: 1,
    });

    if (!error) {
      return true;
    }

    console.warn("reconcile-access: secret probe rejected:", error.message);
    return false;
  } catch (error) {
    console.warn("reconcile-access: secret probe failed:", error);
    return false;
  }
}

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
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Apenas service_role pode chamar esta function
    const authHeader = req.headers.get("Authorization");
    const apiKeyHeader = req.headers.get("apikey");
    const isServiceRole = await isServiceRoleRequest(
      supabaseUrl,
      supabaseServiceKey,
      authHeader,
      apiKeyHeader,
    );

    if (!isServiceRole) {
      console.warn("reconcile-access: auth rejected.");
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const admin = createClient(supabaseUrl, supabaseServiceKey);

    const body: ReconcileRequest = await req.json();
    const { order_id, trigger_source = "manual", force_resend_email = false } = body;

    if (!order_id) {
      return jsonResponse({ error: "order_id é obrigatório" }, 400);
    }

    // ── Etapa 1: Chamar RPC ──
    let rpcResult = await callReconcileRpc(admin, order_id, trigger_source);

    if (rpcResult.status === "error") {
      return jsonResponse({
        success: false,
        ...rpcResult,
      });
    }

    // ── Etapa 2: Se precisa criar auth.user ──
    if (rpcResult.status === "needs_auth_user" && rpcResult.customer_email) {
      const authUserId = await findOrCreateAuthUser(
        admin,
        supabaseUrl,
        supabaseServiceKey,
        rpcResult.customer_email,
        rpcResult.customer_name || rpcResult.customer_email,
        rpcResult.customer_id!,
      );

      if (authUserId && rpcResult.customer_id) {
        // Vincular user_id ao customer (trigger handle_customer_user_link dispara)
        await admin
          .from("customers")
          .update({ user_id: authUserId })
          .eq("id", rpcResult.customer_id);

        // Re-chamar RPC agora que user_id existe
        rpcResult = await callReconcileRpc(admin, order_id, trigger_source);
      }
    }

    // ── Etapa 3: Enviar email se order ativa ──
    let emailStatus: "sent" | "skipped" | "error" | "not_applicable" = "not_applicable";
    let emailReason: "sent" | "already_sent" | "sale_emails_disabled" | "no_auth_user" | "error" | "not_active_order" = "not_active_order";

    // Buscar status da order para decidir se envia email
    const { data: orderCheck } = await admin
      .from("orders")
      .select("status, tenant_id")
      .eq("id", order_id)
      .single();

    const isActive = orderCheck?.status === "approved" || orderCheck?.status === "completed";

    if (!isActive) {
      emailReason = "not_active_order";
    } else if (!rpcResult.user_id) {
      emailReason = "no_auth_user";
    } else if (rpcResult.customer_id && orderCheck?.tenant_id) {
      // Checar deduplicação: já existe email automático bem-sucedido para esta order?
      // (ignora logs com status failed ou skipped — esses não contam como "já enviado")
      const { data: existingEmailLog } = await admin
        .from("email_logs")
        .select("id, status")
        .eq("order_id", order_id)
        .eq("email_type", "reconciliation")
        .in("status", ["sent", "delivered", "opened", "clicked"])
        .limit(1)
        .maybeSingle();

      const alreadySent = !!existingEmailLog;

      if (alreadySent && !force_resend_email) {
        emailStatus = "skipped";
        emailReason = "already_sent";
      } else {
        // Invocar customer-auth-start
        try {
          const emailResp = await admin.functions.invoke("customer-auth-start", {
            body: {
              customer_id: rpcResult.customer_id,
              tenant_id: orderCheck.tenant_id,
              order_id: order_id,
            },
          });

          if (emailResp.error) {
            console.error("reconcile-access: email error:", emailResp.error);
            emailStatus = "error";
            emailReason = "error";
          } else {
            const emailData = emailResp.data as Record<string, unknown> | null;
            if (emailData?.skipped) {
              emailStatus = "skipped";
              emailReason = (emailData.reason as typeof emailReason) || "sale_emails_disabled";
            } else {
              emailStatus = "sent";
              emailReason = "sent";
            }
          }
        } catch (err) {
          console.error("reconcile-access: email invoke error:", err);
          emailStatus = "error";
          emailReason = "error";
        }
      }
    }

    return jsonResponse({
      success: rpcResult.status === "ok",
      ...rpcResult,
      email_status: emailStatus,
      email_reason: emailReason,
      trigger_source,
    });
  } catch (error: unknown) {
    console.error("reconcile-access error:", error);
    return jsonResponse(
      { error: error instanceof Error ? error.message : "Erro interno" },
      500,
    );
  }
});

/* ─── RPC wrapper ─── */

async function callReconcileRpc(
  admin: ReturnType<typeof createClient>,
  orderId: string,
  triggerSource: string,
): Promise<RpcResult> {
  const { data, error } = await admin.rpc("reconcile_order_access", {
    p_order_id: orderId,
    p_trigger_source: triggerSource,
  });

  if (error) {
    console.error("reconcile-access: RPC error:", error);
    return {
      status: "error",
      error_message: error.message,
    };
  }

  return data as RpcResult;
}

/* ─── Auth user find-or-create ─── */

async function findOrCreateAuthUser(
  admin: ReturnType<typeof createClient>,
  supabaseUrl: string,
  supabaseServiceKey: string,
  email: string,
  name: string,
  customerId: string,
): Promise<string | null> {
  const normalizedEmail = email.trim().toLowerCase();
  const randomPassword = crypto.randomUUID() + "Aa1!";

  // Buscar tenant_id do customer para metadata
  const { data: custData } = await admin
    .from("customers")
    .select("tenant_id")
    .eq("id", customerId)
    .single();

  const tenantId = custData?.tenant_id ?? null;

  const { data: newUser, error: createErr } = await admin.auth.admin.createUser({
    email: normalizedEmail,
    email_confirm: true,
    password: randomPassword,
    user_metadata: {
      name,
      signup_as: "customer",
      ...(tenantId && { customer_tenant_id: tenantId }),
    },
  });

  if (createErr) {
    const errMsg = createErr.message || "";
    if (
      errMsg.includes("already been registered") ||
      errMsg.includes("already exists") ||
      errMsg.includes("duplicate")
    ) {
      // Buscar user existente via GoTrue admin API
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
          if (found) return found.id;
        }
      } catch (e) {
        console.warn("reconcile-access: erro ao buscar auth user:", e);
      }
    } else {
      console.error("reconcile-access: erro ao criar auth user:", createErr);
    }
    return null;
  }

  return newUser?.user?.id ?? null;
}
