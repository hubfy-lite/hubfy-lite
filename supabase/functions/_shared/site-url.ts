const DEFAULT_PUBLIC_SITE_URL = "http://localhost:8080";

function normalizeBaseUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const withProtocol = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;

  try {
    const parsed = new URL(withProtocol);
    return parsed.origin;
  } catch {
    return null;
  }
}

function isLocalhostOrigin(origin: string): boolean {
  try {
    const host = new URL(origin).hostname.toLowerCase();
    return host === "localhost" || host === "127.0.0.1" || host === "0.0.0.0" || host === "::1";
  } catch {
    return false;
  }
}

export function resolvePublicSiteUrl(origin: string | null | undefined): string {
  const envUrl = normalizeBaseUrl(Deno.env.get("PUBLIC_SITE_URL"));
  if (envUrl) return envUrl;

  const requestOrigin = normalizeBaseUrl(origin);
  if (requestOrigin && !isLocalhostOrigin(requestOrigin)) return requestOrigin;

  return DEFAULT_PUBLIC_SITE_URL;
}
