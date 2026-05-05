/**
 * integration-registry.ts
 *
 * Single source of truth for all integration provider metadata.
 * Used by integration pages, dialogs, and cards.
 *
 * This file replaces hardcoded provider lists in:
 *   - AdminIntegrations.tsx (SECTIONS, ProviderKey)
 *   - AIKeyDialog.tsx (PROVIDER_META)
 *   - AdminIntegrationEdit.tsx (VALID_PROVIDERS, PROVIDER_META)
 */

// ─── Types ───────────────────────────────────────────────────────────

export type ProviderCategory =
  | "ai"
  | "payments"
  | "crm"
  | "tracking"
  | "video"
  | "automation";

export type ProviderKey =
  | "anthropic"
  | "openai"

  | "hotmart"

  | "chatbase"
  | "hubspot"
  | "mailchimp"
  | "resend"
  | "sendgrid"
  | "slack"
  | "telegram"
  | "twilio"
  | "whatsapp"
  | "zendesk"
  | "inlead"
  | "manychat"
  | "google-ads"
  | "google-analytics"
  | "google-tag-manager"
  | "meta-pixel"
  | "vimeo"
  | "brightcove"
  | "pandavideo"
  | "smartplayer"
  | "wistia"
  | "zoom"
  | "make"
  | "n8n"
  | "supabase"
  | "zapier";

export interface ProviderDefinition {
  key: ProviderKey;
  displayName: string;
  category: ProviderCategory;
  descriptionKey: string;
  logo: string;
  /** Alternative/smaller icon (used in edit pages) */
  icon?: string;
  available: boolean;
  /** Help/docs URL shown in connect dialogs */
  helpUrl?: string;
  /** Input placeholders keyed by credential field name */
  placeholders?: Record<string, string>;
}

// ─── Category display order ─────────────────────────────────────────

export const CATEGORY_ORDER: ProviderCategory[] = [
  "ai",
  "payments",
  "crm",
  "tracking",
  "video",
  "automation",
];

/** i18n keys for category section titles */
export const CATEGORY_TITLE_KEYS: Record<ProviderCategory, string> = {
  ai: "integrationsPage.sectionAI",
  payments: "integrationsPage.sectionPayments",
  crm: "integrationsPage.sectionCRM",
  tracking: "integrationsPage.sectionTracking",
  video: "integrationsPage.sectionVideoHosting",
  automation: "integrationsPage.sectionAutomation",
};

// ─── Provider definitions ───────────────────────────────────────────

export const PROVIDERS: Record<ProviderKey, ProviderDefinition> = {
  // AI
  anthropic: {
    key: "anthropic",
    displayName: "Anthropic",
    category: "ai",
    descriptionKey: "integrations.providers.anthropic.description",
    logo: "/brand/integrations/anthropic.webp",
    available: true,
    helpUrl: "https://console.anthropic.com/settings/keys",
    placeholders: { api_key: "sk-ant-..." },
  },
  openai: {
    key: "openai",
    displayName: "OpenAI",
    category: "ai",
    descriptionKey: "integrations.providers.openai.description",
    logo: "/brand/integrations/openai.webp",
    available: true,
    helpUrl: "https://platform.openai.com/api-keys",
    placeholders: { api_key: "sk-..." },
  },

  // Payments
  hotmart: {
    key: "hotmart",
    displayName: "Hotmart",
    category: "payments",
    descriptionKey: "integrations.providers.hotmart.description",
    logo: "/brand/integrations/hotmart.png",
    icon: "/brand/hotmart-icon.svg",
    available: true,
  },
  // CRM
  chatbase: {
    key: "chatbase",
    displayName: "Chatbase",
    category: "crm",
    descriptionKey: "integrations.providers.chatbase.description",
    logo: "/brand/integrations/chatbase.webp",
    available: false,
  },
  hubspot: {
    key: "hubspot",
    displayName: "HubSpot",
    category: "crm",
    descriptionKey: "integrations.providers.hubspot.description",
    logo: "/brand/integrations/hubspot.svg",
    available: false,
  },
  mailchimp: {
    key: "mailchimp",
    displayName: "Mailchimp",
    category: "crm",
    descriptionKey: "integrations.providers.mailchimp.description",
    logo: "/brand/integrations/mailchimp.webp",
    available: false,
  },
  resend: {
    key: "resend",
    displayName: "Resend",
    category: "crm",
    descriptionKey: "integrations.providers.resend.description",
    logo: "/brand/integrations/resend.webp",
    available: false,
  },
  sendgrid: {
    key: "sendgrid",
    displayName: "SendGrid",
    category: "crm",
    descriptionKey: "integrations.providers.sendgrid.description",
    logo: "/brand/integrations/sendgrid.svg",
    available: false,
  },
  slack: {
    key: "slack",
    displayName: "Slack",
    category: "crm",
    descriptionKey: "integrations.providers.slack.description",
    logo: "/brand/integrations/slack.svg",
    available: false,
  },
  telegram: {
    key: "telegram",
    displayName: "Telegram",
    category: "crm",
    descriptionKey: "integrations.providers.telegram.description",
    logo: "/brand/integrations/telegram.webp",
    available: false,
  },
  twilio: {
    key: "twilio",
    displayName: "Twilio",
    category: "crm",
    descriptionKey: "integrations.providers.twilio.description",
    logo: "/brand/integrations/twilio.webp",
    available: false,
  },
  whatsapp: {
    key: "whatsapp",
    displayName: "WhatsApp",
    category: "crm",
    descriptionKey: "integrations.providers.whatsapp.description",
    logo: "/brand/integrations/whatsapp.webp",
    available: false,
  },
  zendesk: {
    key: "zendesk",
    displayName: "Zendesk",
    category: "crm",
    descriptionKey: "integrations.providers.zendesk.description",
    logo: "/brand/integrations/zendesk.webp",
    available: false,
  },
  inlead: {
    key: "inlead",
    displayName: "Inlead",
    category: "crm",
    descriptionKey: "integrations.providers.inlead.description",
    logo: "/brand/integrations/inlead.webp",
    available: false,
  },
  manychat: {
    key: "manychat",
    displayName: "ManyChat",
    category: "crm",
    descriptionKey: "integrations.providers.manychat.description",
    logo: "/brand/integrations/manychat.webp",
    available: false,
  },

  // Tracking
  "google-ads": {
    key: "google-ads",
    displayName: "Google Ads",
    category: "tracking",
    descriptionKey: "integrations.providers.google-ads.description",
    logo: "/brand/integrations/google-ads.svg",
    available: false,
  },
  "google-analytics": {
    key: "google-analytics",
    displayName: "Google Analytics",
    category: "tracking",
    descriptionKey: "integrations.providers.google-analytics.description",
    logo: "/brand/integrations/google-analytics.svg",
    available: false,
  },
  "google-tag-manager": {
    key: "google-tag-manager",
    displayName: "Google Tag Manager",
    category: "tracking",
    descriptionKey: "integrations.providers.google-tag-manager.description",
    logo: "/brand/integrations/google-tag-manager.svg",
    available: false,
  },
  "meta-pixel": {
    key: "meta-pixel",
    displayName: "Meta Pixel",
    category: "tracking",
    descriptionKey: "integrations.providers.meta-pixel.description",
    logo: "/brand/integrations/meta.webp",
    available: false,
  },

  // Video Hosting
  vimeo: {
    key: "vimeo",
    displayName: "Vimeo",
    category: "video",
    descriptionKey: "integrations.providers.vimeo.description",
    logo: "/brand/integrations/vimeo.svg",
    available: true,
  },
  brightcove: {
    key: "brightcove",
    displayName: "Brightcove",
    category: "video",
    descriptionKey: "integrations.providers.brightcove.description",
    logo: "/brand/integrations/brightcove.webp",
    available: false,
  },
  pandavideo: {
    key: "pandavideo",
    displayName: "Panda Video",
    category: "video",
    descriptionKey: "integrations.providers.pandavideo.description",
    logo: "/brand/integrations/pandavideo.webp",
    helpUrl: "https://dashboard.pandavideo.com.br",
    available: true,
  },
  smartplayer: {
    key: "smartplayer",
    displayName: "Smart Player",
    category: "video",
    descriptionKey: "integrations.providers.smartplayer.description",
    logo: "/brand/integrations/smartplayer.webp",
    available: false,
  },
  wistia: {
    key: "wistia",
    displayName: "Wistia",
    category: "video",
    descriptionKey: "integrations.providers.wistia.description",
    logo: "/brand/integrations/wistia-icon.svg",
    helpUrl: "https://wistia.com/support/developers",
    available: true,
  },
  zoom: {
    key: "zoom",
    displayName: "Zoom",
    category: "video",
    descriptionKey: "integrations.providers.zoom.description",
    logo: "/brand/integrations/zoom.webp",
    available: false,
  },

  // Automation
  make: {
    key: "make",
    displayName: "Make",
    category: "automation",
    descriptionKey: "integrations.providers.make.description",
    logo: "/brand/integrations/make.webp",
    available: false,
  },
  n8n: {
    key: "n8n",
    displayName: "n8n",
    category: "automation",
    descriptionKey: "integrations.providers.n8n.description",
    logo: "/brand/integrations/n8n.webp",
    available: false,
  },
  supabase: {
    key: "supabase",
    displayName: "Supabase",
    category: "automation",
    descriptionKey: "integrations.providers.supabase.description",
    logo: "/brand/integrations/supabase.webp",
    available: false,
  },
  zapier: {
    key: "zapier",
    displayName: "Zapier",
    category: "automation",
    descriptionKey: "integrations.providers.zapier.description",
    logo: "/brand/integrations/zapier.webp",
    available: false,
  },
};

// ─── Helpers ────────────────────────────────────────────────────────

const allProviders = Object.values(PROVIDERS);

/** Returns providers grouped by category in display order. */
export function getProvidersByCategory(): {
  category: ProviderCategory;
  titleKey: string;
  providers: ProviderDefinition[];
}[] {
  return CATEGORY_ORDER.map((cat) => ({
    category: cat,
    titleKey: CATEGORY_TITLE_KEYS[cat],
    providers: allProviders.filter((p) => p.category === cat),
  }));
}

/** Returns only providers that are currently available for connection. */
export function getAvailableProviders(): ProviderDefinition[] {
  return allProviders.filter((p) => p.available);
}

/** Get a single provider definition by key. */
export function getProvider(key: string): ProviderDefinition | undefined {
  return PROVIDERS[key as ProviderKey];
}
