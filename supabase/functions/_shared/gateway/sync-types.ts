/**
 * Gateway Sync — Tipos compartilhados
 *
 * Contratos entre sync adapters, edge function e frontend.
 * Cada provider implementa um SyncAdapter que normaliza o payload
 * do gateway para NormalizedGatewayProduct.
 */

/* ─── Produto normalizado ────────────────────────────────── */

export interface NormalizedGatewayProduct {
  /** ID do produto no gateway externo */
  external_id: string;
  /** Nome do produto */
  name: string;
  /** Status normalizado DO GATEWAY (não do Hubfy) */
  status: "active" | "inactive" | "draft";
  /** Se é produto de assinatura/recorrente */
  is_subscription: boolean;
  /** Preço em centavos (Kiwify expõe, Hotmart não) */
  price_cents: number | null;
  /** Moeda ISO 4217 (BRL, USD) */
  currency: string | null;
  /** Dias de garantia (Hotmart expõe, Kiwify não) */
  warranty_days: number | null;
  /** Data de criação no gateway (ISO string) */
  created_at: string | null;
  /** Já existe mapping com product_id != null? */
  already_imported: boolean;
  /** Se já importado, qual product_id Hubfy está vinculado */
  existing_product_id?: string;
}

/* ─── Adapter interface ──────────────────────────────────── */

/**
 * Cada provider que suporta listing de produtos implementa
 * um SyncAdapter. O adapter é responsável por:
 * 1. Autenticar na API do gateway (OAuth, API Key, etc.)
 * 2. Buscar todos os produtos paginados
 * 3. Normalizar para NormalizedGatewayProduct[]
 * 4. Marcar already_imported com base nos mappings existentes
 *
 * existingMappings: Map<external_product_id, product_id | null>
 *   - product_id presente = já importado (checkbox disabled)
 *   - product_id null = mapping órfão (importável, UPDATE no mapping)
 *   - key ausente = sem mapping (importável, INSERT novo)
 */
export interface SyncAdapter {
  fetchAndNormalize(
    credentials: Record<string, string>,
    existingMappings: Map<string, string | null>,
  ): Promise<NormalizedGatewayProduct[]>;
}

/* ─── Sales sync types ──────────────────────────────────── */

export interface NormalizedSaleBuyer {
  email: string;
  name: string;
  phone?: string;
  document?: string;
  documentType?: string;
  address?: {
    city?: string;
    state?: string;
    country?: string;
    zipcode?: string;
  };
}

export interface NormalizedGatewaySale {
  /** ID do pedido no gateway externo (idempotência) */
  external_order_id: string;
  /** ID do produto no gateway externo */
  external_product_id: string;
  /** Nome do produto no gateway */
  product_name: string;
  /** Dados do comprador */
  buyer: NormalizedSaleBuyer;
  /** Valor em centavos */
  amount_cents: number;
  /** Moeda ISO 4217 */
  currency: string;
  /** Status normalizado (approved, completed, refunded, cancelled, chargeback) */
  status: string;
  /** Método de pagamento normalizado (billet, credit_card, pix, etc.) */
  payment_method: string;
  /** Se é venda de assinatura */
  is_subscription: boolean;
  /** Data do pedido (ISO string) */
  order_date: string;
  /** Já existe em orders (gateway_external_id match) */
  already_imported: boolean;
  /** Produto tem mapping com product_id != null */
  product_mapped: boolean;
  /** ID do produto Hubfy se mapeado */
  hubfy_product_id?: string;
}

export interface SalesSyncSummary {
  total: number;
  /** Total real retornado pela API (antes do cap) */
  total_fetched: number;
  eligible: number;
  already_imported: number;
  unmapped_product: number;
  skipped_status: number;
  skipped_no_email: number;
  unique_customers: number;
  unmapped_products: Array<{ external_id: string; name: string; count: number }>;
  capped: boolean;
}

/** Status que importamos (criam order) */
export const IMPORTABLE_STATUSES = [
  "approved",
  "completed",
  "refunded",
  "cancelled",
  "chargeback",
];

/** Status com revenue ativa (incrementam total_revenue_cents) */
export const ACTIVE_REVENUE_STATUSES = ["approved", "completed"];

export interface SalesSyncAdapter {
  fetchAndNormalize(
    credentials: Record<string, string>,
    dateRange: { startMs: number; endMs: number },
    existingOrderIds: Set<string>,
    productMappings: Map<string, string | null>,
  ): Promise<NormalizedGatewaySale[]>;
}
