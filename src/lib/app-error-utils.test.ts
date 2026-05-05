import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: { invoke: vi.fn() },
  },
}));

import i18n from "@/i18n";
import {
  isEdgeFunctionError,
  translateAppError,
} from "@/lib/app-error-utils";

/**
 * End-to-end schema leak guard: NO combination of inputs should ever
 * cause translateAppError to return raw backend details.
 */
const FORBIDDEN_LEAK_TOKENS = [
  "violates",
  "constraint",
  "relation",
  "bucket",
  "row-level security",
  "duplicate key",
  "permission denied for table",
  "permission denied for relation",
  "storage.objects",
  "new row",
  "failing row",
];

function assertNoSchemaLeak(result: string) {
  const lowered = result.toLowerCase();
  FORBIDDEN_LEAK_TOKENS.forEach((token) => {
    expect(lowered).not.toContain(token.toLowerCase());
  });
}

describe("isEdgeFunctionError", () => {
  it("returns true for errors enriched with _body.code", () => {
    const err = Object.assign(new Error("raw"), {
      _body: { code: "customer_already_exists" },
    });
    expect(isEdgeFunctionError(err)).toBe(true);
  });

  it("returns true for errors enriched with _body.error_code", () => {
    const err = Object.assign(new Error("raw"), {
      _body: { error_code: "RATE_LIMIT_EMAIL" },
    });
    expect(isEdgeFunctionError(err)).toBe(true);
  });

  it("returns true for errors with a snake_case .code at top level", () => {
    const err = Object.assign(new Error("raw"), { code: "already_member" });
    expect(isEdgeFunctionError(err)).toBe(true);
  });

  it("returns false for PostgrestError-shaped errors (5-char SQLSTATE)", () => {
    expect(isEdgeFunctionError({ code: "23505", message: "x" })).toBe(false);
    expect(isEdgeFunctionError({ code: "42501", message: "x" })).toBe(false);
  });

  it("returns false for PGRST-prefixed codes", () => {
    expect(isEdgeFunctionError({ code: "PGRST301", message: "x" })).toBe(false);
  });

  it("returns false for plain Errors with no code", () => {
    expect(isEdgeFunctionError(new Error("plain"))).toBe(false);
  });

  it("returns false for null/undefined", () => {
    expect(isEdgeFunctionError(null)).toBe(false);
    expect(isEdgeFunctionError(undefined)).toBe(false);
  });
});

describe("translateAppError — routing", () => {
  const originalLanguage = i18n.language;

  afterEach(async () => {
    await i18n.changeLanguage(originalLanguage);
  });

  it("routes edge function errors through translateEdgeError", async () => {
    await i18n.changeLanguage("pt-BR");
    const err = Object.assign(new Error("raw"), {
      code: "customer_already_exists",
    });
    expect(translateAppError(err)).toBe(
      "Este email ja e cliente deste workspace.",
    );
  });

  it("routes PostgREST errors through translatePostgrestError", async () => {
    await i18n.changeLanguage("pt-BR");
    const err = {
      code: "23505",
      message: 'duplicate key value violates unique constraint "x"',
    };
    expect(translateAppError(err)).toBe(
      "Ja existe um registro com esses dados.",
    );
  });

  it("routes Storage errors through translateStorageError", async () => {
    await i18n.changeLanguage("en");
    const err = {
      statusCode: "404",
      error: "Not Found",
      message: "The resource was not found",
    };
    expect(translateAppError(err)).toBe("File not found.");
  });

  it("uses custom fallback for unknown shapes when provided", async () => {
    await i18n.changeLanguage("pt-BR");
    const err = new Error("something weird");
    expect(translateAppError(err, "Erro customizado do call site")).toBe(
      "Erro customizado do call site",
    );
  });

  it("uses appErrors._fallback for unknown shapes when no fallback provided", async () => {
    await i18n.changeLanguage("en");
    expect(translateAppError(new Error("weird"))).toBe(
      "Something went wrong. Please try again.",
    );

    await i18n.changeLanguage("pt-BR");
    expect(translateAppError({ random: "shape" })).toBe(
      "Algo deu errado. Tente novamente.",
    );
  });

  it("does NOT let custom fallback override a recognized shape", async () => {
    await i18n.changeLanguage("pt-BR");
    const err = { code: "23505", message: "raw" };
    // Custom fallback is ignored — we use the PostgREST translation instead
    expect(translateAppError(err, "This fallback should be ignored")).toBe(
      "Ja existe um registro com esses dados.",
    );
  });
});

describe("translateAppError — schema leak guard (end-to-end)", () => {
  const originalLanguage = i18n.language;

  afterEach(async () => {
    await i18n.changeLanguage(originalLanguage);
  });

  it("NEVER leaks schema tokens regardless of error shape or language", async () => {
    const leakyErrors = [
      {
        // Unknown PostgREST error with loaded fields
        code: "99999",
        message: 'new row violates row-level security policy for table "products"',
        details: "Failing row contains (abc-123, Course, tenant-xyz)",
        hint: "Check constraint products_name_tenant_key",
      },
      {
        // Known PostgREST error (23505) but with loaded internals
        code: "23505",
        message: 'duplicate key value violates unique constraint "customers_email_key"',
        details: "Key (email)=(leaky@example.com) already exists.",
      },
      {
        // Storage error with bucket leak
        statusCode: "403",
        error: "Forbidden",
        message:
          'new row violates row-level security policy for table "storage.objects"',
      },
      {
        // Totally unknown shape with a "poisoned" .message
        something: true,
        message: "new row violates row-level security policy for table sensitive_data",
      },
      {
        // Plain Error with raw-looking text
        ...new Error(
          'permission denied for relation tenant_credentials',
        ),
      },
    ];

    for (const lang of ["pt-BR", "en", "es"] as const) {
      await i18n.changeLanguage(lang);
      for (const err of leakyErrors) {
        const result = translateAppError(err);
        assertNoSchemaLeak(result);
      }
    }
  });

  it("NEVER returns err.message raw when the shape is unrecognized", async () => {
    await i18n.changeLanguage("en");
    const err = new Error("internal DB leak: secret data for tenant_xyz");
    const result = translateAppError(err);
    expect(result).not.toContain("tenant_xyz");
    expect(result).not.toContain("internal DB leak");
    expect(result).toBe("Something went wrong. Please try again.");
  });

  it("custom fallback is also checked — call site should provide safe text", async () => {
    await i18n.changeLanguage("en");
    const err = new Error("raw thing");
    // If the call site provides a fallback, trust it — the call site is
    // responsible for its own string (usually a t("...") key).
    const result = translateAppError(err, "Failed to save product");
    expect(result).toBe("Failed to save product");
  });
});
