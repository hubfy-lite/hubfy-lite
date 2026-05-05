/**
 * Hotmart REST API helpers.
 *
 * OAuth2 client_credentials + endpoints de catálogo.
 * Usado pelo gateway-sync para importar dados da Hotmart.
 */

import type { NormalizedGatewayProduct, NormalizedGatewaySale } from "./sync-types.ts";

const TOKEN_URL = "https://api-sec-vlc.hotmart.com/security/oauth/token";
const PRODUCTS_URL = "https://developers.hotmart.com/products/api/v1/products";
const SALES_URL = "https://developers.hotmart.com/payments/api/v1/sales/history";

export interface HotmartProduct {
  id: string;
  name: string;
  ucode: string;
  status: string;
  format: string;
  is_subscription: boolean;
  warranty_period: number;
  created_at: number;
}

export interface HotmartCredentials {
  clientId: string;
  clientSecret: string;
}

/**
 * Parseia o texto bruto colado pelo usuário e extrai client_id + client_secret.
 *
 * Aceita dois formatos:
 *
 * 1) Bloco da Hotmart (com ou sem linha "Basic:"):
 *    Client ID: xxx
 *    Client Secret: yyy
 *    Basic: Basic zzz          ← ignorado
 *
 * 2) Formato legado:
 *    clientId:clientSecret
 */
export function parseHotmartCredentials(raw: string): HotmartCredentials {
  const text = raw.trim();

  // Formato bloco: procura "Client ID:" e "Client Secret:"
  const idMatch = text.match(/Client\s*ID\s*:\s*(.+)/i);
  const secretMatch = text.match(/Client\s*Secret\s*:\s*(.+)/i);

  if (idMatch && secretMatch) {
    return {
      clientId: idMatch[1].trim(),
      clientSecret: secretMatch[1].trim(),
    };
  }

  // Formato legado: clientId:clientSecret
  // Também aceita se o user colou "Basic xxxx" — decodifica o base64
  if (text.toLowerCase().startsWith("basic ")) {
    try {
      const decoded = atob(text.slice(6).trim());
      const [id, secret] = decoded.split(":");
      if (id && secret) return { clientId: id, clientSecret: secret };
    } catch {
      // base64 inválido, cai no erro abaixo
    }
  }

  const colonIndex = text.indexOf(":");
  if (colonIndex > 0) {
    const id = text.slice(0, colonIndex).trim();
    const secret = text.slice(colonIndex + 1).trim();
    if (id && secret) return { clientId: id, clientSecret: secret };
  }

  throw new Error(
    "Formato de credenciais inválido. Cole as credenciais da Hotmart com Client ID e Client Secret.",
  );
}

/**
 * OAuth2 client_credentials → access_token.
 *
 * Segue a doc oficial da Hotmart:
 * POST /oauth/token?grant_type=client_credentials&client_id=X&client_secret=Y
 * Authorization: Basic base64(clientId:clientSecret)
 */
export async function getAccessToken(
  creds: HotmartCredentials,
): Promise<string> {
  const basic = "Basic " + btoa(creds.clientId + ":" + creds.clientSecret);

  const url =
    `${TOKEN_URL}?grant_type=client_credentials` +
    `&client_id=${encodeURIComponent(creds.clientId)}` +
    `&client_secret=${encodeURIComponent(creds.clientSecret)}`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: basic,
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    const body = await res.text();
    console.error("Hotmart token error:", body);
    throw new Error(
      "Falha ao autenticar na Hotmart. Verifique as credenciais da API.",
    );
  }

  const { access_token } = await res.json();
  return access_token as string;
}

/**
 * Lista todos os produtos do vendedor na Hotmart.
 * Percorre todas as páginas automaticamente (cursor-based).
 */
export async function fetchProducts(
  accessToken: string,
): Promise<HotmartProduct[]> {
  const all: HotmartProduct[] = [];
  let pageToken: string | null = null;

  while (true) {
    let url = `${PRODUCTS_URL}?max_results=50`;
    if (pageToken) {
      url += `&page_token=${encodeURIComponent(pageToken)}`;
    }

    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) {
      const body = await res.text();
      console.error("Hotmart products error:", body);
      throw new Error("Falha ao listar produtos da Hotmart.");
    }

    const data = await res.json();
    const items: unknown[] = data.items ?? [];

    for (const p of items) {
      const item = p as Record<string, unknown>;
      all.push({
        id: String(item.id),
        name: String(item.name ?? ""),
        ucode: String(item.ucode ?? ""),
        status: String(item.status ?? "DRAFT"),
        format: String(item.format ?? ""),
        is_subscription: Boolean(item.is_subscription),
        warranty_period: Number(item.warranty_period ?? 0),
        created_at: Number(item.created_at ?? 0),
      });
    }

    const nextToken = data.page_info?.next_page_token;
    if (!nextToken) break;
    pageToken = nextToken;
  }

  return all;
}

/* ─── Normalização ───────────────────────────────────────── */

function normalizeHotmartStatus(raw: string): NormalizedGatewayProduct["status"] {
  if (raw === "ACTIVE") return "active";
  return "inactive";
}

/**
 * Converte HotmartProduct[] → NormalizedGatewayProduct[].
 *
 * existingMappings: Map<external_product_id, product_id | null>
 */
export function normalizeHotmartProducts(
  products: HotmartProduct[],
  existingMappings: Map<string, string | null>,
): NormalizedGatewayProduct[] {
  return products.map((hp) => {
    const externalId = String(hp.id);
    const mappedProductId = existingMappings.get(externalId);
    const alreadyImported = mappedProductId !== undefined && mappedProductId !== null;

    return {
      external_id: externalId,
      name: hp.name,
      status: normalizeHotmartStatus(hp.status),
      is_subscription: hp.is_subscription,
      price_cents: null,
      currency: null,
      warranty_days: hp.warranty_period > 0 ? hp.warranty_period : null,
      created_at: hp.created_at > 0
        ? new Date(hp.created_at).toISOString()
        : null,
      already_imported: alreadyImported,
      ...(alreadyImported && { existing_product_id: mappedProductId }),
    };
  });
}

/* ═══════════════════════════════════════════════════════════
 * Sales — Histórico de vendas
 * ═══════════════════════════════════════════════════════════ */

export interface HotmartSale {
  product: { id: number | string; name?: string };
  buyer: {
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
  purchase: {
    transaction?: string;
    order_date?: number;
    approved_date?: number;
    status?: string;
    is_subscription?: boolean;
    recurrency_number?: number;
    price?: { value?: number; currency_code?: string };
    payment?: { type?: string; method?: string; installments_number?: number };
    offer?: { code?: string; payment_mode?: string };
  };
}

/** Mapeamento de status da API de vendas → order_status Hubfy */
const SALE_STATUS_MAP: Record<string, string> = {
  APPROVED: "approved",
  COMPLETE: "completed",
  CANCELLED: "cancelled",
  REFUNDED: "refunded",
  CHARGEBACK: "chargeback",
  PARTIALLY_REFUNDED: "refunded",
};

/** Mapeamento de payment.type → normalizado (igual ao webhook adapter) */
const SALE_PAYMENT_MAP: Record<string, string> = {
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

/**
 * Lista vendas da Hotmart para um período.
 * Busca status APPROVED + COMPLETE por default, depois adiciona outros status relevantes.
 */
export async function fetchHotmartSales(
  accessToken: string,
  startMs: number,
  endMs: number,
): Promise<HotmartSale[]> {
  const all: HotmartSale[] = [];
  const seenTx = new Set<string>();

  // Buscar cada grupo de status separadamente
  // Default (sem filtro) retorna APPROVED + COMPLETE
  // Depois buscamos os outros status que queremos importar
  const statusGroups: (string | null)[] = [
    null, // default: APPROVED + COMPLETE
    "REFUNDED",
    "CANCELLED",
    "CHARGEBACK",
    "PARTIALLY_REFUNDED",
  ];

  for (const statusFilter of statusGroups) {
    let pageToken: string | null = null;

    while (true) {
      let url = `${SALES_URL}?max_results=50&start_date=${startMs}&end_date=${endMs}`;
      if (statusFilter) {
        url += `&transaction_status=${encodeURIComponent(statusFilter)}`;
      }
      if (pageToken) {
        url += `&page_token=${encodeURIComponent(pageToken)}`;
      }

      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      });

      if (!res.ok) {
        const body = await res.text();
        console.error(`Hotmart sales error (status=${statusFilter}):`, body);
        // Se for 400 para um status específico, pula (API pode não aceitar)
        if (statusFilter && res.status === 400) break;
        throw new Error("Falha ao listar vendas da Hotmart.");
      }

      const data = await res.json();
      const items: unknown[] = data.items ?? [];

      for (const item of items) {
        const sale = item as HotmartSale;
        const tx = sale.purchase?.transaction;
        if (tx && !seenTx.has(tx)) {
          seenTx.add(tx);
          all.push(sale);
        }
      }

      const nextToken = data.page_info?.next_page_token;
      if (!nextToken) break;
      pageToken = nextToken;
    }
  }

  return all;
}

/**
 * Normaliza vendas da Hotmart para NormalizedGatewaySale[].
 */
export function normalizeHotmartSales(
  sales: HotmartSale[],
  existingOrderIds: Set<string>,
  productMappings: Map<string, string | null>,
): NormalizedGatewaySale[] {
  return sales.map((s) => {
    const externalOrderId = s.purchase?.transaction ?? "";
    const externalProductId = String(s.product?.id ?? "");
    const rawStatus = s.purchase?.status ?? "";
    const status = SALE_STATUS_MAP[rawStatus] ?? rawStatus.toLowerCase();
    const rawPayment = s.purchase?.payment?.type ?? "";
    const paymentMethod = SALE_PAYMENT_MAP[rawPayment] || "hotmart";

    const priceValue = s.purchase?.price?.value ?? 0;
    const amountCents = Math.round(priceValue * 100);

    const orderDateMs = s.purchase?.order_date ?? s.purchase?.approved_date ?? 0;
    const orderDate = orderDateMs > 0
      ? new Date(orderDateMs).toISOString()
      : new Date().toISOString();

    const mappedProductId = productMappings.get(externalProductId);
    const productMapped = mappedProductId !== undefined && mappedProductId !== null;

    const buyer = s.buyer ?? {};
    const email = (buyer.email ?? "").trim().toLowerCase();

    return {
      external_order_id: externalOrderId,
      external_product_id: externalProductId,
      product_name: s.product?.name ?? "",
      buyer: {
        email,
        name: buyer.name?.trim() || email,
        phone: (buyer.checkout_phone || buyer.phone || "").trim() || undefined,
        document: buyer.document?.trim() || undefined,
        documentType: buyer.document_type?.trim() || undefined,
        ...(buyer.address && (buyer.address.city || buyer.address.state || buyer.address.country) && {
          address: {
            city: buyer.address.city?.trim() || undefined,
            state: buyer.address.state?.trim() || undefined,
            country: buyer.address.country?.trim() || undefined,
            zipcode: buyer.address.zipcode?.trim() || undefined,
          },
        }),
      },
      amount_cents: amountCents,
      currency: s.purchase?.price?.currency_code ?? "BRL",
      status,
      payment_method: paymentMethod,
      is_subscription: Boolean(s.purchase?.is_subscription),
      order_date: orderDate,
      already_imported: existingOrderIds.has(externalOrderId),
      product_mapped: productMapped,
      ...(productMapped && { hubfy_product_id: mappedProductId }),
    };
  });
}
