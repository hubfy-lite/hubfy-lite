/**
 * Shared helper for building consistent error responses across all edge functions.
 *
 * Every error response should include:
 *   - `error`: English developer/log message (NOT shown directly to users)
 *   - `code`: stable snake_case identifier that the frontend maps to
 *     translated messages via `i18n.t("edgeErrors.<code>")`
 *
 * Example:
 *   return errorResponse("customer_already_exists", "Customer exists", 409, corsHeaders);
 *
 * The frontend's `invokeEdgeFunction` utility extracts the `code` and translates
 * it. If a code has no translation in locale files, it falls back to the raw
 * `error` message (graceful degradation).
 */

export interface ErrorResponseExtra {
  [key: string]: unknown;
}

/**
 * Build a JSON error Response with a stable `code` for i18n mapping.
 *
 * @param code    snake_case identifier, e.g. "customer_already_exists"
 * @param message English developer/log message (not user-facing)
 * @param status  HTTP status code (400, 401, 403, 404, 409, 429, 500, etc.)
 * @param corsHeaders CORS headers to include in the response
 * @param extra   Optional additional fields (e.g. retry_after_seconds)
 */
export function errorResponse(
  code: string,
  message: string,
  status: number,
  corsHeaders: Record<string, string>,
  extra?: ErrorResponseExtra,
): Response {
  return new Response(
    JSON.stringify({ error: message, code, ...(extra ?? {}) }),
    {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
}
