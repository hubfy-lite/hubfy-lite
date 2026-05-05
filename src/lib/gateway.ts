/**
 * Gateway Configuration
 *
 * Configs, types e helpers para gateways de pagamento.
 * Para adicionar um novo gateway, basta adicionar aqui + adapter no backend.
 */

export type GatewayProvider = "hotmart";

export const GATEWAY_PROVIDERS: GatewayProvider[] = [
  "hotmart",
];

export function isGatewayProvider(provider: string): provider is GatewayProvider {
  return GATEWAY_PROVIDERS.includes(provider as GatewayProvider);
}

/* ─── Credential Fields ──────────────────────────────────── */

export interface CredentialField {
  key: string;
  label: string;
  required: boolean;
  type: "text" | "textarea" | "password";
  helpText?: string;
  placeholder?: string;
}

export const GATEWAY_CREDENTIALS_CONFIG: Record<GatewayProvider, CredentialField[]> = {
  hotmart: [
    {
      key: "hottok",
      label: "Hottok",
      required: true,
      type: "text",
      helpText: "Token que valida os webhooks. Encontre em Hotmart > Ferramentas > Webhook > Hottok.",
      placeholder: "ex: aB1cD2eF3gH4iJ5kL6mN7oP8qR9sT0",
    },
    {
      key: "basic_auth",
      label: "Credenciais da API",
      required: false,
      type: "textarea",
      helpText: "Cole aqui exatamente o conteúdo da chave de acesso fornecida pela Hotmart, com Client ID, Client Secret e Basic.",
      placeholder: "Client ID: ...\nClient Secret: ...\nBasic: Basic ...",
    },
  ],
};

/* ─── Webhook URL ────────────────────────────────────────── */

/**
 * Gera a URL determinística do webhook para um provider + tenant.
 * Fonte única de verdade — nunca usar webhook_url persistido.
 */
export function buildWebhookUrl(provider: GatewayProvider, tenantId: string): string {
  const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string).replace(/\/$/, "");
  return `${supabaseUrl}/functions/v1/gateway-webhook/${provider}/${tenantId}`;
}

/* ─── Sync API Helpers ──────────────────────────────────── */

/** Provider tem API de listagem de produtos? */
export function providerSupportsSyncApi(provider: GatewayProvider): boolean {
  return provider === "hotmart";
}

/** Chaves de credencial necessárias para sync API */
export function getApiCredentialKeys(provider: GatewayProvider): string[] {
  if (provider === "hotmart") return ["basic_auth"];
  return [];
}

/** Verifica se todas as credenciais necessárias estão presentes no hint */
export function hasApiCredentials(
  provider: GatewayProvider,
  hint: Record<string, string> | null,
): boolean {
  if (!hint || !providerSupportsSyncApi(provider)) return false;
  return getApiCredentialKeys(provider).every((k) => !!hint[k]);
}

/** Chaves que devem ser mascaradas no credentials_hint (últimos 4 chars) */
const SENSITIVE_CREDENTIAL_KEYS = new Set(["client_secret"]);

/** Mascara valor sensível: "full-value-here" → "••••here" */
export function maskCredentialValue(key: string, value: string): string {
  if (!SENSITIVE_CREDENTIAL_KEYS.has(key) || value.length <= 4) return value;
  return "••••" + value.slice(-4);
}
