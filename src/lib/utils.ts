import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Extract a raw message from an unknown caught error.
 *
 * **UNSAFE for user-facing contexts.** This function returns `error.message`
 * as-is, which for Supabase queries/storage leaks schema details (table names,
 * constraint names, RLS policies, bucket paths). It is also not i18n-aware.
 *
 * @deprecated For user-facing contexts (toasts, alert descriptions, setError),
 * use `translateAppError` from `@/lib/app-error-utils` instead. That helper
 * detects the error shape and routes to a locale-aware, schema-safe translator.
 *
 * Only remaining safe uses of this function:
 *   - Logging / debugging (console.error, Sentry context)
 *   - Error comparisons against sentinel strings inside our own control flow
 *
 * @see translateAppError
 */
export function getErrorMessage(error: unknown, fallback = "Erro inesperado"): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error !== null && "message" in error) {
    return String((error as { message: unknown }).message);
  }
  if (typeof error === "string") return error;
  return fallback;
}

/**
 * Format a date string for display in the UI.
 *
 * Rules:
 * - pt-BR / es → DD/MM/AAAA HH:MM
 * - en         → MM/DD/YYYY HH:MM
 *
 * @param dateStr  ISO date string (or null/undefined → "—")
 * @param lang     i18n language code (e.g. "pt-BR", "en", "es")
 */
export function formatDateTime(
  dateStr: string | null | undefined,
  lang = "pt-BR",
): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "—";

  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");

  if (lang === "en") return `${mm}/${dd}/${yyyy} ${hh}:${min}`;
  return `${dd}/${mm}/${yyyy} ${hh}:${min}`;
}

/**
 * Format a date string (date only, no time).
 */
export function formatDateOnly(
  dateStr: string | null | undefined,
  lang = "pt-BR",
): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "—";

  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();

  if (lang === "en") return `${mm}/${dd}/${yyyy}`;
  return `${dd}/${mm}/${yyyy}`;
}
