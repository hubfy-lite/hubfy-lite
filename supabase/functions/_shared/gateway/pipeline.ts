/**
 * Universal Gateway Pipeline
 *
 * Lógica de negócio comum a TODOS os gateways de pagamento.
 * Recebe um NormalizedEvent (já validado e normalizado pelo adapter)
 * e executa: produto → customer → order → revenue → acesso → email.
 */

import type {
  AdminClient,
  PipelineContext,
  PipelineResult,
} from "./types.ts";
import { logEventReceived, updateEventLog } from "./event-logger.ts";
import { resolveProduct } from "./product-resolver.ts";
import { findOrCreateCustomer } from "./customer-manager.ts";

/* ─── Progressões de status válidas ──────────────────────── */

const VALID_PROGRESSIONS: Record<string, string[]> = {
  approved: ["completed"],
};

/* ─── Entry point ────────────────────────────────────────── */

export async function processGatewayEvent(
  admin: AdminClient,
  ctx: PipelineContext,
): Promise<PipelineResult> {
  const logId = await logEventReceived(admin, ctx);

  try {
    await updateEventLog(admin, logId, "processing");

    switch (ctx.event.eventType) {
      case "approved":
      case "completed":
        return await handleApproval(admin, ctx, logId);

      case "cancelled":
      case "refunded":
      case "chargeback":
        return await handleRevocation(admin, ctx, logId);

      case "disputed":
        return await handleDispute(admin, ctx, logId);

      case "pending":
        return await handlePending(admin, ctx, logId);

      default:
        await updateEventLog(admin, logId, "ignored", `Evento ${ctx.event.rawEvent} não processado.`);
        return { status: "ignored" };
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`${ctx.provider}: pipeline error:`, message);
    await updateEventLog(admin, logId, "failed", message);
    return { status: "failed", error: message };
  }
}

/* ─── Aprovação (PURCHASE_APPROVED / PURCHASE_COMPLETE) ─── */

async function handleApproval(
  admin: AdminClient,
  ctx: PipelineContext,
  logId: string | null,
): Promise<PipelineResult> {
  const { event, tenantId, integrationId, provider } = ctx;

  if (!event.externalProductId) {
    await updateEventLog(admin, logId, "failed", "product.id ausente no payload");
    return { status: "failed", error: "missing_product_id" };
  }

  // 1. Idempotência com progressão de status
  if (event.externalOrderId) {
    const { data: existing } = await admin
      .from("orders")
      .select("id, status")
      .eq("tenant_id", tenantId)
      .eq("gateway_provider", provider)
      .eq("gateway_external_id", event.externalOrderId)
      .maybeSingle();

    if (existing) {
      const validNext = VALID_PROGRESSIONS[existing.status] ?? [];
      if (validNext.includes(event.eventType)) {
        // Progressão válida (ex: approved → completed)
        await admin.from("orders").update({ status: event.eventType }).eq("id", existing.id);

        const reconcileResult = await invokeReconcileAccess(admin, existing.id, provider);

        await updateEventLog(admin, logId, "processed", null, {
          action: "order_updated",
          order_id: existing.id,
          old_status: existing.status,
          new_status: event.eventType,
          email_status: reconcileResult?.email_status ?? null,
        });
        return { status: "processed", orderId: existing.id, action: "order_updated" };
      }

      // Duplicata
      await updateEventLog(admin, logId, "duplicate", null, { existing_order_id: existing.id });
      return { status: "duplicate", orderId: existing.id };
    }
  }

  // 2. Resolve produto via gateway_product_mappings
  const product = await resolveProduct(admin, tenantId, provider, event.externalProductId);
  if (!product) {
    await updateEventLog(
      admin, logId, "ignored",
      `Produto ${provider} ${event.externalProductId} não vinculado. Vincule em Integrações > Mapeamento e reprocesse este evento.`,
    );
    return { status: "ignored", error: "product_not_mapped" };
  }

  // 3. Find-or-create customer
  const customerId = await findOrCreateCustomer(admin, tenantId, event.buyer);
  if (!customerId) {
    await updateEventLog(admin, logId, "failed", "Não foi possível identificar/criar o customer");
    return { status: "failed", error: "customer_not_resolved" };
  }

  // 4. Cria order
  const unitAmount = event.amountCents > 0
    ? event.amountCents
    : (product.unitAmount ?? 0);

  const orderInsert: Record<string, unknown> = {
    tenant_id: tenantId,
    customer_id: customerId,
    product_id: product.id,
    status: event.eventType,
    unit_amount: unitAmount,
    payment_method: event.paymentMethod,
    gateway_external_id: event.externalOrderId || null,
    gateway_provider: provider,
    integration_id: integrationId,
    gateway_order_created_at: event.orderCreatedAt || null,
    is_order_bump: event.isOrderBump,
    parent_gateway_external_id: event.parentExternalOrderId || null,
    source: "external_gateway",
  };

  if (event.isSubscription) {
    orderInsert.type = "subscription";
    orderInsert.subscription_status = event.subscriptionStatus ?? "active";
  }

  const { data: order, error: orderErr } = await admin
    .from("orders")
    .insert(orderInsert)
    .select("id")
    .single();

  if (orderErr || !order) {
    // Idempotência: UNIQUE index pode rejeitar duplicata por concorrência
    if (orderErr?.message?.includes("duplicate key") || orderErr?.message?.includes("unique")) {
      await updateEventLog(admin, logId, "duplicate", null, { reason: "concurrent_duplicate" });
      return { status: "duplicate" };
    }
    await updateEventLog(admin, logId, "failed", orderErr?.message ?? "Falha ao criar order");
    return { status: "failed", error: orderErr?.message ?? "order_creation_failed" };
  }

  // 5. Incrementa revenue (transition-safe: só na criação da order)
  if (unitAmount > 0) {
    admin
      .rpc("increment_customer_revenue", {
        p_customer_id: customerId,
        p_amount: unitAmount,
      })
      .then(() => {})
      .catch((err: unknown) => console.warn(`${provider}: increment_revenue error:`, err));
  }

  // 6. Reconcilia acesso (identidade + cursos + email)
  const reconcileResult = await invokeReconcileAccess(admin, order.id, provider);

  await updateEventLog(admin, logId, "processed", null, {
    action: "order_created",
    order_id: order.id,
    customer_id: customerId,
    product_id: product.id,
    is_order_bump: event.isOrderBump,
    email_status: reconcileResult?.email_status ?? null,
    email_reason: reconcileResult?.email_reason ?? null,
  });

  return { status: "processed", orderId: order.id, customerId, action: "order_created" };
}

/* ─── Revogação (CANCEL / REFUND / CHARGEBACK) ───────────── */

async function handleRevocation(
  admin: AdminClient,
  ctx: PipelineContext,
  logId: string | null,
): Promise<PipelineResult> {
  const { event, tenantId, provider } = ctx;

  if (!event.externalOrderId) {
    await updateEventLog(admin, logId, "failed", "transaction ID ausente");
    return { status: "failed", error: "missing_order_id" };
  }

  // Busca order existente
  const { data: existingOrder } = await admin
    .from("orders")
    .select("id, status, unit_amount, customer_id")
    .eq("tenant_id", tenantId)
    .eq("gateway_provider", provider)
    .eq("gateway_external_id", event.externalOrderId)
    .maybeSingle();

  if (!existingOrder) {
    // SUBSCRIPTION_CANCELLATION com transaction que não existe = ignorar
    await updateEventLog(admin, logId, "ignored", `Order não encontrada para transaction ${event.externalOrderId}`);
    return { status: "ignored", error: "order_not_found" };
  }

  // Idempotência: se já está no status terminal, não reprocessar
  if (existingOrder.status === event.eventType) {
    await updateEventLog(admin, logId, "duplicate", null, {
      existing_order_id: existingOrder.id,
      reason: "already_" + event.eventType,
    });
    return { status: "duplicate", orderId: existingOrder.id };
  }

  // Atualiza status da order
  // Revenue é ajustado automaticamente pelo trigger trg_adjust_customer_revenue
  const updateFields: Record<string, unknown> = { status: event.eventType };
  if (event.subscriptionStatus) {
    updateFields.subscription_status = event.subscriptionStatus;
  }

  const { error: updErr } = await admin
    .from("orders")
    .update(updateFields)
    .eq("id", existingOrder.id);

  if (updErr) {
    await updateEventLog(admin, logId, "failed", updErr.message);
    return { status: "failed", error: updErr.message };
  }

  // Reconcilia acesso (revoga cursos)
  await invokeReconcileAccess(admin, existingOrder.id, provider);

  await updateEventLog(admin, logId, "processed", null, {
    action: "status_updated",
    order_id: existingOrder.id,
    new_status: event.eventType,
  });

  return { status: "processed", orderId: existingOrder.id, action: "status_updated" };
}

/* ─── Disputa (PURCHASE_PROTEST) ──────────────────────────── */

async function handleDispute(
  admin: AdminClient,
  ctx: PipelineContext,
  logId: string | null,
): Promise<PipelineResult> {
  const { event, tenantId, integrationId, provider } = ctx;

  if (!event.externalOrderId) {
    await updateEventLog(admin, logId, "failed", "transaction ID ausente");
    return { status: "failed", error: "missing_order_id" };
  }

  // Se order existe, só atualiza status
  const { data: existingOrder } = await admin
    .from("orders")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("gateway_provider", provider)
    .eq("gateway_external_id", event.externalOrderId)
    .maybeSingle();

  if (existingOrder) {
    await admin.from("orders").update({ status: "disputed" }).eq("id", existingOrder.id);
    await updateEventLog(admin, logId, "processed", null, {
      action: "status_updated",
      order_id: existingOrder.id,
      new_status: "disputed",
    });
    return { status: "processed", orderId: existingOrder.id, action: "status_updated" };
  }

  // Order não existe: cria customer + order com status disputed (sem acesso, sem email)
  if (!event.externalProductId) {
    await updateEventLog(admin, logId, "failed", "product.id ausente no payload");
    return { status: "failed", error: "missing_product_id" };
  }

  const product = await resolveProduct(admin, tenantId, provider, event.externalProductId);
  if (!product) {
    await updateEventLog(admin, logId, "ignored", `Produto ${event.externalProductId} não vinculado.`);
    return { status: "ignored", error: "product_not_mapped" };
  }

  const customerId = await findOrCreateCustomer(admin, tenantId, event.buyer);
  if (!customerId) {
    await updateEventLog(admin, logId, "failed", "Não foi possível criar customer");
    return { status: "failed", error: "customer_not_resolved" };
  }

  const unitAmount = event.amountCents > 0 ? event.amountCents : (product.unitAmount ?? 0);

  const { data: order, error: orderErr } = await admin
    .from("orders")
    .insert({
      tenant_id: tenantId,
      customer_id: customerId,
      product_id: product.id,
      status: "disputed",
      unit_amount: unitAmount,
      payment_method: event.paymentMethod,
      gateway_external_id: event.externalOrderId,
      gateway_provider: provider,
      integration_id: integrationId,
      gateway_order_created_at: event.orderCreatedAt || null,
      source: "external_gateway",
    })
    .select("id")
    .single();

  if (orderErr || !order) {
    if (orderErr?.message?.includes("duplicate key") || orderErr?.message?.includes("unique")) {
      await updateEventLog(admin, logId, "duplicate", null, { reason: "concurrent_duplicate" });
      return { status: "duplicate" };
    }
    await updateEventLog(admin, logId, "failed", orderErr?.message ?? "Falha ao criar order");
    return { status: "failed", error: "order_creation_failed" };
  }

  await updateEventLog(admin, logId, "processed", null, {
    action: "order_created",
    order_id: order.id,
    new_status: "disputed",
  });

  return { status: "processed", orderId: order.id, customerId, action: "order_created" };
}

/* ─── Pendente (PURCHASE_DELAYED) ─────────────────────────── */

async function handlePending(
  admin: AdminClient,
  ctx: PipelineContext,
  logId: string | null,
): Promise<PipelineResult> {
  const { event, tenantId, provider } = ctx;

  if (!event.externalOrderId) {
    await updateEventLog(admin, logId, "failed", "transaction ID ausente");
    return { status: "failed", error: "missing_order_id" };
  }

  const { data: order } = await admin
    .from("orders")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("gateway_provider", provider)
    .eq("gateway_external_id", event.externalOrderId)
    .maybeSingle();

  if (!order) {
    await updateEventLog(admin, logId, "ignored", `Pagamento atrasado ignorado: pedido ${event.externalOrderId} não encontrado.`);
    return { status: "ignored", error: "order_not_found" };
  }

  await admin
    .from("orders")
    .update({ subscription_status: "past_due" })
    .eq("id", order.id);

  await updateEventLog(admin, logId, "processed", null, {
    action: "subscription_past_due",
    order_id: order.id,
  });

  return { status: "processed", orderId: order.id, action: "subscription_past_due" };
}

/* ─── Helper: invocar reconcile-access ────────────────────── */

async function invokeReconcileAccess(
  admin: AdminClient,
  orderId: string,
  triggerSource: string,
): Promise<Record<string, unknown> | null> {
  try {
    const resp = await admin.functions.invoke("reconcile-access", {
      body: { order_id: orderId, trigger_source: triggerSource },
    });
    if (resp.error) {
      console.error(`${triggerSource}: reconcile-access error:`, resp.error);
      return null;
    }
    return resp.data as Record<string, unknown>;
  } catch (err: unknown) {
    console.error(`${triggerSource}: reconcile-access invoke error:`, err);
    return null;
  }
}
