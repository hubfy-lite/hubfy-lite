/**
 * Translation helper for Supabase Storage errors.
 *
 * Supabase Storage errors have a distinct shape from PostgREST errors:
 * they carry a `statusCode` (as string!) and an `error` type string.
 *
 * Example raw errors we want to hide from users:
 *   { statusCode: "404", error: "Not Found", message: "The resource was not found" }
 *   { statusCode: "403", error: "Forbidden", message: "new row violates row-level security policy" }
 *   { statusCode: "413", error: "Payload Too Large", message: "The object exceeded the maximum allowed size" }
 *
 * The fallback is ALWAYS `dbErrors.storage_generic` — we never return
 * `err.message` raw because it contains bucket names, paths, and RLS details.
 */

import i18n from "@/i18n";

// ── Types ──────────────────────────────────────────────────────────

/** Shape of a Supabase Storage error */
export interface StorageErrorLike {
  statusCode?: string | number | null;
  error?: string | null;
  message?: string | null;
  name?: string | null;
}

// ── Maps ───────────────────────────────────────────────────────────

const STATUS_CODE_MAP: Record<string, string> = {
  "400": "storage_invalid_request",
  "401": "storage_forbidden",
  "403": "storage_forbidden",
  "404": "storage_not_found",
  "409": "storage_conflict",
  "413": "storage_file_too_large",
  "415": "storage_unsupported_media_type",
  "429": "storage_rate_limited",
  "500": "storage_generic",
  "502": "storage_generic",
  "503": "storage_generic",
};

// ── Translator ─────────────────────────────────────────────────────

/**
 * Translates a Storage error into a user-facing, locale-aware string.
 *
 * Resolution order:
 * 1. `STATUS_CODE_MAP[statusCode]` — semantic code → i18n
 * 2. `dbErrors.storage_generic` — NEVER `err.message` raw
 */
export function translateStorageError(err: unknown): string {
  const semanticCode = resolveStorageSemanticCode(err);
  if (semanticCode) {
    const key = `dbErrors.${semanticCode}`;
    const translated = i18n.t(key);
    if (translated !== key) return translated;
  }
  return i18n.t("dbErrors.storage_generic");
}

/**
 * Maps a raw StorageError to a semantic code.
 * Exported so other helpers can reuse the routing logic.
 */
export function resolveStorageSemanticCode(err: unknown): string | null {
  const e = err as StorageErrorLike | null;
  const raw = e?.statusCode;
  if (raw === null || raw === undefined) return null;

  // statusCode can be string or number depending on supabase-js version
  const statusCode = String(raw);
  return STATUS_CODE_MAP[statusCode] ?? null;
}

/**
 * Type guard: does this look like a Supabase Storage error?
 *
 * Storage errors always carry a `statusCode` and an `error` (category) field.
 * We check both to avoid collisions with PostgrestError (which also has `.message`).
 */
export function isStorageError(err: unknown): err is StorageErrorLike {
  if (!err || typeof err !== "object") return false;
  const e = err as Record<string, unknown>;
  const hasStatusCode =
    typeof e.statusCode === "string" || typeof e.statusCode === "number";
  const hasErrorField = typeof e.error === "string";
  return hasStatusCode && hasErrorField;
}
