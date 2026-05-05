// Shared error helpers for the public REST API (edge function "api").
//
// Convention:
//   { "error": { "code": "<snake_case>", "message": "<human>", "details": {...}? } }
//
// Every handler throws an ApiError or returns a normal Response.
// The top-level router converts ApiError → HTTP response via toApiErrorResponse.

export class ApiError extends Error {
  status: number;
  code: string;
  details?: Record<string, unknown>;

  constructor(
    status: number,
    code: string,
    message: string,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function notFound(code: string, message: string): ApiError {
  return new ApiError(404, code, message);
}

export function badRequest(
  code: string,
  message: string,
  details?: Record<string, unknown>,
): ApiError {
  return new ApiError(400, code, message, details);
}

export function unauthorized(code: string, message: string): ApiError {
  return new ApiError(401, code, message);
}

export function forbidden(code: string, message: string): ApiError {
  return new ApiError(403, code, message);
}

export function internal(
  code = "internal_error",
  message = "Internal server error",
): ApiError {
  return new ApiError(500, code, message);
}

export function toApiErrorResponse(
  err: unknown,
  corsHeaders: Record<string, string>,
): Response {
  if (err instanceof ApiError) {
    const body: Record<string, unknown> = {
      error: {
        code: err.code,
        message: err.message,
      },
    };
    if (err.details) {
      (body.error as Record<string, unknown>).details = err.details;
    }
    return new Response(JSON.stringify(body), {
      status: err.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // AuthError from _shared/auth.ts — convert shape
  if (err && typeof err === "object" && "status" in err && "code" in err) {
    const e = err as { status: number; code: string; message: string };
    return new Response(
      JSON.stringify({ error: { code: e.code, message: e.message } }),
      {
        status: e.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  const message = (err as Error)?.message || "Internal server error";
  console.error("API unhandled error:", err);
  return new Response(
    JSON.stringify({ error: { code: "internal_error", message } }),
    {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
}

export function jsonResponse(
  body: unknown,
  status: number,
  corsHeaders: Record<string, string>,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
