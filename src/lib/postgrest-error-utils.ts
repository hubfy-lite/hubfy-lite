/**
 * Translation helper for PostgREST errors (Supabase `.from(...)` / `.rpc(...)` calls).
 *
 * Routes SQLSTATE codes to semantic i18n keys in `dbErrors.<code>`.
 * The fallback is ALWAYS a safe generic message — we NEVER return
 * `err.message` / `err.details` / `err.hint` raw, because those contain
 * internal schema details (table names, constraint names, RLS policies,
 * column values) that leak the database structure to end users.
 *
 * @see https://www.postgresql.org/docs/current/errcodes-appendix.html
 */

import i18n from "@/i18n";

// ── Types ──────────────────────────────────────────────────────────

/** Shape of a Supabase PostgrestError (from @supabase/postgrest-js) */
export interface PostgrestErrorLike {
  code?: string | null;
  message?: string | null;
  details?: string | null;
  hint?: string | null;
}

// ── SQLSTATE maps ──────────────────────────────────────────────────

/**
 * Specific SQLSTATE codes we want to translate to precise messages.
 * Covers the ~10 codes that account for >95% of user-visible errors.
 */
const SQLSTATE_SPECIFIC: Record<string, string> = {
  "23505": "db_unique_violation",         // unique_violation
  "23503": "db_foreign_key_violation",    // foreign_key_violation
  "23502": "db_not_null_violation",       // not_null_violation
  "23514": "db_check_violation",          // check_violation
  "23P01": "db_exclusion_violation",      // exclusion_violation
  "22P02": "db_invalid_input",            // invalid_text_representation
  "42501": "db_permission_denied",        // insufficient_privilege
  "40001": "db_serialization_failure",    // serialization_failure
  "57014": "db_query_canceled",           // query_canceled (statement timeout)
  // PostgREST-specific (prefixed with PGRST)
  "PGRST301": "db_rls_violation",         // JWT expired / RLS
  "PGRST116": "db_not_found",             // .single() found 0 rows
  "PGRST204": "db_not_found",             // no rows affected
};

/**
 * Fallback by SQLSTATE class (2-char prefix).
 * When a specific code is not mapped, we still give a meaningful category.
 *
 * @see https://www.postgresql.org/docs/current/errcodes-appendix.html
 */
const SQLSTATE_CLASS: Record<string, string> = {
  "08": "db_connection_error",       // Class 08 — Connection Exception
  "22": "db_invalid_input",          // Class 22 — Data Exception
  "23": "db_constraint_violation",   // Class 23 — Integrity Constraint Violation
  "40": "db_transaction_rollback",   // Class 40 — Transaction Rollback
  "42": "db_permission_denied",      // Class 42 — Syntax Error / Access Rule Violation
  "53": "db_resource_exhausted",     // Class 53 — Insufficient Resources
  "57": "db_query_canceled",         // Class 57 — Operator Intervention
  "58": "db_system_error",           // Class 58 — System Error (external to Postgres)
};

// ── Translator ─────────────────────────────────────────────────────

/**
 * Translates a PostgREST error into a user-facing, locale-aware string.
 *
 * Resolution order:
 * 1. Specific SQLSTATE (`SQLSTATE_SPECIFIC[code]`)
 * 2. SQLSTATE class fallback (`SQLSTATE_CLASS[code.substring(0, 2)]`)
 * 3. `dbErrors._generic` — NEVER `err.message` raw
 */
export function translatePostgrestError(err: unknown): string {
  const semanticCode = resolvePostgrestSemanticCode(err);
  if (semanticCode) {
    const key = `dbErrors.${semanticCode}`;
    const translated = i18n.t(key);
    if (translated !== key) return translated;
  }
  return i18n.t("dbErrors._generic");
}

/**
 * Maps a raw PostgrestError to a semantic code (snake_case).
 * Exported so other helpers (tests, app-error-utils) can share the logic.
 */
export function resolvePostgrestSemanticCode(err: unknown): string | null {
  const e = err as PostgrestErrorLike | null;
  const code = e?.code;
  if (!code || typeof code !== "string") return null;

  // 1. Try specific match
  if (SQLSTATE_SPECIFIC[code]) return SQLSTATE_SPECIFIC[code];

  // 2. Try class fallback (Postgres SQLSTATE is always 5 chars, prefix 2)
  //    PostgREST codes (PGRST*) are not 5-char SQLSTATE — skip class lookup
  if (code.length === 5 && /^[0-9A-Z]{5}$/.test(code)) {
    const classPrefix = code.substring(0, 2);
    if (SQLSTATE_CLASS[classPrefix]) return SQLSTATE_CLASS[classPrefix];
  }

  return null;
}

/**
 * Type guard: does this look like a PostgrestError?
 *
 * A PostgrestError has `.code` + at least one of `.message`, `.details`, `.hint`.
 * We're permissive because supabase-js sometimes returns objects that match
 * this shape even outside queries (e.g. RPC errors).
 */
export function isPostgrestError(err: unknown): err is PostgrestErrorLike {
  if (!err || typeof err !== "object") return false;
  const e = err as Record<string, unknown>;
  if (typeof e.code !== "string") return false;
  // Must have at least one of the PostgrestError-shaped fields
  return (
    "message" in e ||
    "details" in e ||
    "hint" in e
  );
}
