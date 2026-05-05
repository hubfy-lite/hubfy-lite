/**
 * Unified app-wide error translator.
 *
 * Detects the error shape and routes to the appropriate specialized helper:
 *   - Edge function errors (enriched by invokeEdgeFunction) → translateEdgeError
 *   - PostgREST errors (from supabase.from/.rpc) → translatePostgrestError
 *   - Supabase Storage errors → translateStorageError
 *   - Plain Errors / unknown shapes → safe fallback
 *
 * This is the ONLY error helper that should be used in user-facing contexts
 * (toasts, alert descriptions, setError calls). It guarantees that raw
 * database/storage messages (which leak schema details) are never shown
 * to end users.
 *
 * @example
 * try {
 *   await supabase.from("products").insert(...);
 * } catch (error) {
 *   toast.error(translateAppError(error));
 * }
 *
 * @example
 * // With a domain-specific fallback for cases where the error shape is unknown:
 * toast.error(translateAppError(error, t("productSheet.uploadError")));
 */

import i18n from "@/i18n";
import { translateEdgeError } from "@/lib/edge-function-utils";
import {
  isPostgrestError,
  translatePostgrestError,
} from "@/lib/postgrest-error-utils";
import {
  isStorageError,
  translateStorageError,
} from "@/lib/storage-error-utils";

// ── Type guards ────────────────────────────────────────────────────

/**
 * Detects an error that came through `invokeEdgeFunction` (v1 wrapper).
 *
 * These errors are enriched with a `.code` (snake_case) or `._body.code` /
 * `._body.error_code`. We also accept a bare Error that has `.code`
 * matching a plausible edge function code shape.
 */
export function isEdgeFunctionError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as Record<string, unknown>;

  // Has _body with code field → definitely edge function wrapper
  if (e._body && typeof e._body === "object") {
    const body = e._body as Record<string, unknown>;
    if (typeof body.code === "string" || typeof body.error_code === "string") {
      return true;
    }
  }

  // Has a top-level snake_case / SCREAMING_SNAKE code (and is not PostgREST-shaped)
  if (typeof e.code === "string") {
    // PostgREST errors also have .code but they are SQLSTATE numeric (5 chars)
    // or PGRST-prefixed. Edge function codes are snake_case identifiers.
    const looksLikeSqlState = /^[0-9A-Z]{5}$/.test(e.code) || e.code.startsWith("PGRST");
    if (looksLikeSqlState) return false;
    return true;
  }

  return false;
}

// ── Main delegator ─────────────────────────────────────────────────

/**
 * Translates any error into a user-facing, locale-aware, safe string.
 *
 * @param err      Any caught error
 * @param fallback Optional custom message shown when no shape is recognized.
 *                 When the shape IS recognized, the specialized translator
 *                 wins — the fallback is never used to override a real
 *                 translation.
 * @returns A safe, localized message. Guaranteed not to leak database
 *          schema, storage bucket names, or raw backend error details.
 */
export function translateAppError(err: unknown, fallback?: string): string {
  // 1. Edge function errors (v1 wrapper) — most specific, check first
  if (isEdgeFunctionError(err)) {
    return translateEdgeError(err);
  }

  // 2. Supabase Storage errors — check before PostgREST because Storage
  //    errors also have `.message` but are distinguished by `.statusCode + .error`
  if (isStorageError(err)) {
    return translateStorageError(err);
  }

  // 3. PostgREST / RPC errors
  if (isPostgrestError(err)) {
    return translatePostgrestError(err);
  }

  // 4. Unknown shape — use custom fallback if provided, else safe generic
  if (fallback) return fallback;
  return i18n.t("appErrors._fallback");
}
