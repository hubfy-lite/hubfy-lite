/**
 * Shared utilities for consuming Supabase edge functions from React hooks.
 *
 * The main entry point is `invokeEdgeFunction` — a drop-in replacement for
 * `supabase.functions.invoke` that automatically extracts the real error
 * message from edge function responses instead of surfacing the generic
 * "Edge Function returned a non-2xx status code".
 */

import { supabase } from "@/integrations/supabase/client";
import type { FunctionInvokeOptions } from "@supabase/supabase-js";
import i18n from "@/i18n";

// ── Types ──────────────────────────────────────────────────────────

/** Parsed error from an edge function response */
export interface EdgeFunctionErrorDetails {
  status?: number;
  code?: string;
  message: string;
}

// ── Helpers ────────────────────────────────────────────────────────

/**
 * Reads the JSON body from a FunctionsHttpError.
 * In supabase-js v2.95+, error.context is the raw Response object
 * (body not yet consumed), so we need to await .json() on it.
 * Must be called in async context (mutationFn / queryFn) before throwing.
 */
export async function readEdgeFunctionBody(
  err: unknown,
): Promise<Record<string, unknown>> {
  try {
    if (err && typeof err === "object") {
      const ctx = (err as any).context;
      // ctx is a Response object with an unconsumed body
      if (ctx && typeof ctx.json === "function") {
        return await ctx.json();
      }
      // Already-parsed object (older versions or enriched errors)
      if (ctx && typeof ctx === "object" && typeof ctx.error === "string") {
        return ctx;
      }
    }
  } catch {
    // body already consumed or not JSON — fall through
  }
  return {};
}

/**
 * Resolves the best user-facing message from an edge function response body.
 * Precedence: provider_message → message → reason → error → fallback
 */
function resolveMessage(
  body: Record<string, unknown>,
  fallback: string,
): string {
  const candidate =
    body.provider_message ?? body.message ?? body.reason ?? body.error;
  return candidate ? String(candidate) : fallback;
}

// ── Main wrapper ──────────────────────────────────────────────────

/**
 * Drop-in replacement for `supabase.functions.invoke()`.
 *
 * - On non-2xx: reads `error.context` (Response body) and throws an Error
 *   with the real message from the edge function.
 * - On `data.error`: throws an Error with the most descriptive message.
 * - On success: returns `{ data }` typed as `T`.
 *
 * The thrown Error is enriched with `.code`, `.status`, and `._body`
 * for callers that need flow control (retry logic, i18n mapping, etc.).
 *
 * @example
 * // Simple — error automatically throws with the real message
 * const { data } = await invokeEdgeFunction("gateway-connect", {
 *   body: { provider, tenant_id, credentials },
 * });
 *
 * @example
 * // With metadata access
 * try {
 *   await invokeEdgeFunction("creator-signup-start", { body: { ... } });
 * } catch (err) {
 *   const code = (err as any)._body?.error_code ?? "TEMPORARY_UNAVAILABLE";
 * }
 */
export async function invokeEdgeFunction<T = Record<string, unknown>>(
  functionName: string,
  options?: FunctionInvokeOptions,
): Promise<{ data: T }> {
  const { data, error } = await supabase.functions.invoke(functionName, options);

  if (error) {
    const body = await readEdgeFunctionBody(error);
    const message = resolveMessage(body, error.message);
    const enriched = new Error(message);
    (enriched as any).code = body.code ?? body.error_code;
    (enriched as any).status = (error as any).context?.status;
    (enriched as any)._body = body;
    throw enriched;
  }

  // Some edge functions return 200 with { error: "..." } in the body
  if (data?.error) {
    const message = resolveMessage(data, data.error);
    const enriched = new Error(message);
    (enriched as any).code = data.code ?? data.error_code;
    (enriched as any)._body = data;
    throw enriched;
  }

  return { data: data as T };
}

// ── Error inspection (used by video hooks for retry / display) ────

/**
 * Sync parser for errors already enriched with _body (set by invokeEdgeFunction).
 * Returns the translated message (via i18n `edgeErrors.<code>`), falling back
 * to the raw backend message when no translation exists.
 */
export function parseEdgeFunctionError(err: unknown): EdgeFunctionErrorDetails {
  if (err && typeof err === "object") {
    const e = err as any;
    const body = e._body ?? {};
    const code = body.code ?? body.error_code ?? e.code ?? undefined;
    const status = e.status ?? undefined;
    // Use translateEdgeError for consistency — it handles the code→i18n path
    // and falls back gracefully to the raw message.
    const msg = translateEdgeError(err);
    return { code, status, message: msg };
  }
  return { message: translateEdgeError(err) };
}

const NON_RETRYABLE_CODES = new Set([
  "missing_authorization", "invalid_auth_token", "forbidden_tenant", "integration_not_found",
  "vimeo_api_error", "pandavideo_api_error", "wistia_api_error",
]);

/** Whether this error should NOT be retried */
export function isNonRetryable(err: unknown): boolean {
  const { code } = parseEdgeFunctionError(err);
  return NON_RETRYABLE_CODES.has(code ?? "");
}

// ── i18n translation ──────────────────────────────────────────────

/**
 * Translates an edge function error into the user's current language.
 *
 * Resolution order:
 *   1. If error has a `.code` or `._body.code`/`._body.error_code`, look up
 *      `edgeErrors.<code>` in the current locale.
 *   2. If the key exists (translation !== key), return it.
 *   3. Otherwise, fall back to `err.message` (the raw backend message).
 *   4. If no message exists at all, return `edgeErrors._fallback`.
 *
 * Works outside React context because it uses the i18n singleton directly.
 * Safe to call from mutation `onError` callbacks, components, or hooks.
 *
 * @example
 * import { toast } from "sonner";
 * import { translateEdgeError } from "@/lib/edge-function-utils";
 *
 * onError: (err) => toast.error(translateEdgeError(err))
 */
export function translateEdgeError(err: unknown): string {
  const e = err as any;
  const rawCode: string =
    e?.code ?? e?._body?.code ?? e?._body?.error_code ?? "";

  // Normalize SCREAMING_SNAKE to snake_case and kebab-case to snake_case
  const code = rawCode.toLowerCase().replace(/-/g, "_");

  const fallbackMessage = (): string => {
    if (typeof e?.message === "string" && e.message.length > 0) return e.message;
    return i18n.t("edgeErrors._fallback");
  };

  if (!code) return fallbackMessage();

  const key = `edgeErrors.${code}`;
  const translated = i18n.t(key);

  // i18next returns the key itself when no translation is found
  if (translated === key) return fallbackMessage();
  return translated;
}
