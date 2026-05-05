/**
 * Hotmart Adapter
 *
 * Valida hottok e normaliza payloads da Hotmart para NormalizedEvent.
 */

import type { NormalizedEvent, ProviderAdapter } from "../types.ts";

/* ─── Tipos do payload Hotmart ─────────────────────────────── */

interface HotmartPayload {
  hottok?: string;
  event?: string;
  data?: {
    purchase?: {
      transaction?: string;
      status?: string;
      order_date?: number | string;
      price?: { value?: number; currency_value?: string };
      payment?: { type?: string };
      recurrence_number?: number;
    };
    product?: { id: number | string; name?: string };
    buyer?: {
      email?: string;
      name?: string;
      first_name?: string;
      last_name?: string;
      phone?: string;
      checkout_phone?: string;
      document?: string;
      document_type?: string;
      address?: { city?: string; state?: string; country?: string; zipcode?: string };
    };
    order_bump?: { is_order_bump?: boolean; parent_purchase_transaction?: string };
    subscription?: {
      subscriber?: { code?: string };
      plan?: { id?: number; name?: string };
      status?: string;
    };
  };
}

/* ─── Mapeamentos ──────────────────────────────────────────── */

const EVENT_STATUS_MAP: Record<string, NormalizedEvent["eventType"]> = {
  PURCHASE_APPROVED: "approved",
  PURCHASE_COMPLETE: "completed",
  PURCHASE_CANCELED: "cancelled",
  PURCHASE_REFUNDED: "refunded",
  PURCHASE_CHARGEBACK: "chargeback",
  PURCHASE_PROTEST: "disputed",
  PURCHASE_DELAYED: "pending",
  SUBSCRIPTION_CANCELLATION: "cancelled",
};

const PAYMENT_MAP: Record<string, string> = {
  BILLET: "billet",
  CASH_PAYMENT: "dinheiro",
  CREDIT_CARD: "credit_card",
  DIRECT_BANK_TRANSFER: "bank_transfer",
  DIRECT_DEBIT: "debit",
  FINANCED_BILLET: "financed",
  FINANCED_INSTALLMENT: "financed",
  GOOGLE_PAY: "google_pay",
  HOTCARD: "credit_card",
  HYBRID: "hybrid",
  MANUAL_TRANSFER: "manual",
  PAYPAL: "paypal",
  PAYPAL_INTERNACIONAL: "paypal",
  PICPAY: "picpay",
  PIX: "pix",
  SAMSUNG_PAY: "samsung_pay",
  WALLET: "hotmart",
};

/* ─── Adapter ──────────────────────────────────────────────── */

export const hotmartAdapter: ProviderAdapter = {
  provider: "hotmart",

  validateAuth(
    request: Request,
    _rawBody: string,
    body: unknown,
    credentials: Record<string, string>,
  ): boolean {
    const payload = body as HotmartPayload;
    const headerHottok = request.headers.get("x-hotmart-hottok") ?? "";
    const bodyHottok = payload?.hottok ?? "";
    const receivedHottok = headerHottok || bodyHottok;

    if (!receivedHottok) return false;

    const storedHottok = credentials.hottok ?? "";
    return receivedHottok === storedHottok;
  },

  normalizeEvent(body: unknown): NormalizedEvent | null {
    const payload = body as HotmartPayload;
    const event = payload?.event ?? "";
    const eventType = EVENT_STATUS_MAP[event];

    if (!eventType) return null;

    const data = payload.data;
    const purchase = data?.purchase;
    const buyer = data?.buyer;
    const product = data?.product;
    const orderBump = data?.order_bump;
    const subscription = data?.subscription;

    // Payment method
    const rawPaymentType = purchase?.payment?.type ?? "";
    const paymentMethod = PAYMENT_MAP[rawPaymentType] ?? "hotmart";

    // Amount em centavos
    const amountCents = purchase?.price?.value != null
      ? Math.round(purchase.price.value * 100)
      : 0;

    // Currency
    const currency = purchase?.price?.currency_value ?? "BRL";

    // Subscription detection
    const recurrenceNumber = purchase?.recurrence_number ?? 0;
    const hasSubscription = !!subscription;
    const isSubscription = recurrenceNumber > 0 || hasSubscription;

    // Subscription status para SUBSCRIPTION_CANCELLATION
    let subscriptionStatus: NormalizedEvent["subscriptionStatus"];
    if (event === "SUBSCRIPTION_CANCELLATION") {
      subscriptionStatus = "cancelled";
    } else if (event === "PURCHASE_DELAYED") {
      subscriptionStatus = "past_due";
    } else if (isSubscription) {
      subscriptionStatus = "active";
    }

    // Order timestamp
    const orderCreatedAt = parseHotmartTimestamp(purchase?.order_date);

    return {
      eventType,
      externalOrderId: purchase?.transaction ?? "",
      externalProductId: product?.id ? String(product.id) : "",
      buyer: {
        email: buyer?.email?.trim().toLowerCase() ?? "",
        name: buyer?.name?.trim() || buyer?.email?.trim().toLowerCase() || "",
        firstName: buyer?.first_name?.trim() || undefined,
        lastName: buyer?.last_name?.trim() || undefined,
        phone: buyer?.checkout_phone?.trim() || buyer?.phone?.trim() || undefined,
        document: buyer?.document?.trim() || undefined,
        documentType: buyer?.document_type?.trim() || undefined,
        address: buyer?.address ? {
          city: buyer.address.city?.trim() || undefined,
          state: buyer.address.state?.trim() || undefined,
          country: buyer.address.country?.trim() || undefined,
          zipcode: buyer.address.zipcode?.trim() || undefined,
        } : undefined,
      },
      amountCents,
      paymentMethod,
      currency,
      isSubscription,
      subscriptionStatus,
      isOrderBump: !!orderBump?.is_order_bump,
      parentExternalOrderId: orderBump?.parent_purchase_transaction || undefined,
      orderCreatedAt: orderCreatedAt || undefined,
      rawEvent: event,
    };
  },
};

/* ─── Helper ───────────────────────────────────────────────── */

function parseHotmartTimestamp(value: number | string | undefined): string | null {
  if (value == null) return null;
  const unixMs = Number(value);
  if (!Number.isFinite(unixMs) || unixMs <= 0) return null;
  const date = new Date(unixMs);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}
