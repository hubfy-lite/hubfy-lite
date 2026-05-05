import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: { invoke: vi.fn() },
  },
}));

import i18n from "@/i18n";
import {
  isPostgrestError,
  resolvePostgrestSemanticCode,
  translatePostgrestError,
} from "@/lib/postgrest-error-utils";

/**
 * Tokens that must NEVER appear in a translated PostgrestError output.
 * If any of these leak through, we're exposing database schema to end users.
 */
const FORBIDDEN_LEAK_TOKENS = [
  "violates",
  "constraint",
  "relation",
  "column",
  "key value",
  "row-level security",
  "duplicate key",
  "new row",
  "failing row",
  "permission denied for table",
  "permission denied for relation",
  "permission denied for schema",
  "foreign key",
  "check constraint",
  "not-null constraint",
];

function assertNoSchemaLeak(result: string) {
  const lowered = result.toLowerCase();
  FORBIDDEN_LEAK_TOKENS.forEach((token) => {
    expect(lowered).not.toContain(token.toLowerCase());
  });
}

describe("resolvePostgrestSemanticCode", () => {
  it("maps specific SQLSTATE codes to semantic identifiers", () => {
    expect(resolvePostgrestSemanticCode({ code: "23505" })).toBe(
      "db_unique_violation",
    );
    expect(resolvePostgrestSemanticCode({ code: "23503" })).toBe(
      "db_foreign_key_violation",
    );
    expect(resolvePostgrestSemanticCode({ code: "23502" })).toBe(
      "db_not_null_violation",
    );
    expect(resolvePostgrestSemanticCode({ code: "23514" })).toBe(
      "db_check_violation",
    );
    expect(resolvePostgrestSemanticCode({ code: "42501" })).toBe(
      "db_permission_denied",
    );
    expect(resolvePostgrestSemanticCode({ code: "22P02" })).toBe(
      "db_invalid_input",
    );
    expect(resolvePostgrestSemanticCode({ code: "40001" })).toBe(
      "db_serialization_failure",
    );
    expect(resolvePostgrestSemanticCode({ code: "57014" })).toBe(
      "db_query_canceled",
    );
  });

  it("maps PostgREST-specific codes", () => {
    expect(resolvePostgrestSemanticCode({ code: "PGRST301" })).toBe(
      "db_rls_violation",
    );
    expect(resolvePostgrestSemanticCode({ code: "PGRST116" })).toBe(
      "db_not_found",
    );
  });

  it("falls back to SQLSTATE class when specific code is unknown", () => {
    // 23xxx that is not in the specific map → db_constraint_violation
    expect(resolvePostgrestSemanticCode({ code: "23777" })).toBe(
      "db_constraint_violation",
    );
    // 08xxx (Connection Exception)
    expect(resolvePostgrestSemanticCode({ code: "08006" })).toBe(
      "db_connection_error",
    );
    // 42xxx (syntax/access) → db_permission_denied is the safe fallback
    expect(resolvePostgrestSemanticCode({ code: "42999" })).toBe(
      "db_permission_denied",
    );
    // 57xxx (Operator Intervention)
    expect(resolvePostgrestSemanticCode({ code: "57999" })).toBe(
      "db_query_canceled",
    );
  });

  it("returns null for codes that don't match any class", () => {
    expect(resolvePostgrestSemanticCode({ code: "99999" })).toBeNull();
    expect(resolvePostgrestSemanticCode({ code: "XX000" })).toBeNull();
  });

  it("returns null for PGRST codes that are not mapped (no class fallback for PGRST)", () => {
    expect(resolvePostgrestSemanticCode({ code: "PGRST999" })).toBeNull();
  });

  it("returns null when there's no code at all", () => {
    expect(resolvePostgrestSemanticCode({})).toBeNull();
    expect(resolvePostgrestSemanticCode(null)).toBeNull();
    expect(resolvePostgrestSemanticCode(undefined)).toBeNull();
  });
});

describe("translatePostgrestError", () => {
  const originalLanguage = i18n.language;

  afterEach(async () => {
    await i18n.changeLanguage(originalLanguage);
  });

  describe("translates known codes", () => {
    it("returns Portuguese when language is pt-BR", async () => {
      await i18n.changeLanguage("pt-BR");
      expect(translatePostgrestError({ code: "23505" })).toBe(
        "Ja existe um registro com esses dados.",
      );
      expect(translatePostgrestError({ code: "42501" })).toBe(
        "Voce nao tem permissao para fazer essa operacao.",
      );
    });

    it("returns English when language is en", async () => {
      await i18n.changeLanguage("en");
      expect(translatePostgrestError({ code: "23505" })).toBe(
        "A record with this data already exists.",
      );
      expect(translatePostgrestError({ code: "PGRST301" })).toBe(
        "You don't have permission to access this resource.",
      );
    });

    it("returns Spanish when language is es", async () => {
      await i18n.changeLanguage("es");
      expect(translatePostgrestError({ code: "23505" })).toBe(
        "Ya existe un registro con estos datos.",
      );
    });
  });

  describe("class fallback", () => {
    it("unknown 23xxx falls back to db_constraint_violation", async () => {
      await i18n.changeLanguage("en");
      expect(translatePostgrestError({ code: "23777" })).toBe(
        "The data violates a system rule.",
      );
    });
  });

  describe("generic fallback for unknown errors", () => {
    it("returns dbErrors._generic when code is completely unknown", async () => {
      await i18n.changeLanguage("pt-BR");
      expect(translatePostgrestError({ code: "99999" })).toBe(
        "Nao foi possivel completar a operacao. Tente novamente.",
      );
    });

    it("returns dbErrors._generic when there's no code", async () => {
      await i18n.changeLanguage("en");
      expect(translatePostgrestError({ message: "whatever" })).toBe(
        "Could not complete the operation. Please try again.",
      );
      expect(translatePostgrestError(null)).toBe(
        "Could not complete the operation. Please try again.",
      );
    });
  });

  describe("schema leak guard", () => {
    it("NEVER leaks schema tokens for unknown PostgREST error with loaded .message/.details/.hint", async () => {
      await i18n.changeLanguage("en");
      const leakyError = {
        code: "99999",
        message:
          'new row violates row-level security policy for table "products"',
        details: "Failing row contains (abc-123, My Course, tenant-xyz-789)",
        hint: "Check the constraint products_tenant_id_name_key",
      };
      const result = translatePostgrestError(leakyError);
      assertNoSchemaLeak(result);
      // And specifically, it should NOT contain any of the input strings
      expect(result).not.toContain("products");
      expect(result).not.toContain("abc-123");
      expect(result).not.toContain("tenant-xyz-789");
      expect(result).not.toContain("products_tenant_id_name_key");
    });

    it("NEVER leaks schema tokens even for known codes with loaded details", async () => {
      await i18n.changeLanguage("pt-BR");
      const unique = {
        code: "23505",
        message:
          'duplicate key value violates unique constraint "customers_tenant_email_key"',
        details: "Key (tenant_id, email)=(abc-123, leaky@example.com) already exists.",
      };
      const result = translatePostgrestError(unique);
      assertNoSchemaLeak(result);
      expect(result).not.toContain("customers_tenant_email_key");
      expect(result).not.toContain("leaky@example.com");
      expect(result).not.toContain("abc-123");
    });

    it("NEVER leaks schema tokens for permission denied errors", async () => {
      await i18n.changeLanguage("en");
      const denied = {
        code: "42501",
        message: 'permission denied for table "subscriptions"',
        details: null,
      };
      const result = translatePostgrestError(denied);
      assertNoSchemaLeak(result);
      expect(result).not.toContain("subscriptions");
    });
  });
});

describe("isPostgrestError", () => {
  it("returns true for objects with code + message/details/hint", () => {
    expect(isPostgrestError({ code: "23505", message: "x" })).toBe(true);
    expect(isPostgrestError({ code: "42501", details: "x" })).toBe(true);
    expect(isPostgrestError({ code: "PGRST301", hint: "x" })).toBe(true);
  });

  it("returns false for plain errors", () => {
    expect(isPostgrestError(new Error("plain"))).toBe(false);
    expect(isPostgrestError({ message: "plain" })).toBe(false);
  });

  it("returns false for null/undefined/primitives", () => {
    expect(isPostgrestError(null)).toBe(false);
    expect(isPostgrestError(undefined)).toBe(false);
    expect(isPostgrestError("string")).toBe(false);
    expect(isPostgrestError(42)).toBe(false);
  });

  it("returns false for objects without a code", () => {
    expect(isPostgrestError({ message: "x", details: "y" })).toBe(false);
  });

  it("returns false for objects where code is not a string", () => {
    expect(isPostgrestError({ code: 42, message: "x" })).toBe(false);
  });
});
