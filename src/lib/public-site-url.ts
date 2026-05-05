const DEFAULT_PUBLIC_SITE_URL = "http://localhost:8784";

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

export function getPublicSiteUrl(): string {
  const envUrl = normalizeBaseUrl(import.meta.env.VITE_PUBLIC_SITE_URL);
  if (envUrl) return envUrl;

  if (typeof window !== "undefined") {
    const currentOrigin = normalizeBaseUrl(window.location.origin);
    if (!currentOrigin) return DEFAULT_PUBLIC_SITE_URL;

    if (import.meta.env.DEV) return currentOrigin;
    if (!isLocalhostOrigin(currentOrigin)) return currentOrigin;
  }

  return DEFAULT_PUBLIC_SITE_URL;
}

export function buildPublicUrl(pathname: string): string {
  const normalizedPath = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return `${getPublicSiteUrl()}${normalizedPath}`;
}
