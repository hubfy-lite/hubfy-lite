import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: { invoke: vi.fn() },
  },
}));

import i18n from "@/i18n";
import {
  isStorageError,
  resolveStorageSemanticCode,
  translateStorageError,
} from "@/lib/storage-error-utils";

const FORBIDDEN_LEAK_TOKENS = [
  "bucket",
  "row-level security",
  "storage.objects",
  "permission denied",
  "new row violates",
  "failing row",
];

function assertNoSchemaLeak(result: string) {
  const lowered = result.toLowerCase();
  FORBIDDEN_LEAK_TOKENS.forEach((token) => {
    expect(lowered).not.toContain(token.toLowerCase());
  });
}

describe("resolveStorageSemanticCode", () => {
  it("maps common HTTP status codes (as strings)", () => {
    expect(resolveStorageSemanticCode({ statusCode: "404", error: "Not Found" })).toBe(
      "storage_not_found",
    );
    expect(resolveStorageSemanticCode({ statusCode: "403", error: "Forbidden" })).toBe(
      "storage_forbidden",
    );
    expect(resolveStorageSemanticCode({ statusCode: "413", error: "Payload Too Large" })).toBe(
      "storage_file_too_large",
    );
    expect(resolveStorageSemanticCode({ statusCode: "415", error: "Unsupported Media Type" })).toBe(
      "storage_unsupported_media_type",
    );
    expect(resolveStorageSemanticCode({ statusCode: "429", error: "Too Many Requests" })).toBe(
      "storage_rate_limited",
    );
  });

  it("also accepts numeric statusCode", () => {
    expect(resolveStorageSemanticCode({ statusCode: 404, error: "Not Found" })).toBe(
      "storage_not_found",
    );
  });

  it("returns null for unknown status codes", () => {
    expect(resolveStorageSemanticCode({ statusCode: "418", error: "Teapot" })).toBeNull();
    expect(resolveStorageSemanticCode({ statusCode: "999", error: "Unknown" })).toBeNull();
  });

  it("returns null when statusCode is missing", () => {
    expect(resolveStorageSemanticCode({})).toBeNull();
    expect(resolveStorageSemanticCode({ error: "Not Found" })).toBeNull();
  });
});

describe("translateStorageError", () => {
  const originalLanguage = i18n.language;

  afterEach(async () => {
    await i18n.changeLanguage(originalLanguage);
  });

  describe("translates known status codes", () => {
    it("404 → translated 'file not found' in active locale", async () => {
      await i18n.changeLanguage("pt-BR");
      expect(
        translateStorageError({ statusCode: "404", error: "Not Found", message: "x" }),
      ).toBe("Arquivo nao encontrado.");

      await i18n.changeLanguage("en");
      expect(
        translateStorageError({ statusCode: "404", error: "Not Found", message: "x" }),
      ).toBe("File not found.");

      await i18n.changeLanguage("es");
      expect(
        translateStorageError({ statusCode: "404", error: "Not Found", message: "x" }),
      ).toBe("Archivo no encontrado.");
    });

    it("413 → file too large", async () => {
      await i18n.changeLanguage("en");
      expect(
        translateStorageError({ statusCode: "413", error: "Payload Too Large", message: "x" }),
      ).toBe("File exceeds the maximum allowed size.");
    });

    it("403 → forbidden (storage-specific permission message)", async () => {
      await i18n.changeLanguage("en");
      expect(
        translateStorageError({ statusCode: "403", error: "Forbidden", message: "x" }),
      ).toBe("You don't have permission to access this file.");
    });
  });

  describe("generic fallback", () => {
    it("returns storage_generic when status code is unknown", async () => {
      await i18n.changeLanguage("en");
      expect(
        translateStorageError({ statusCode: "418", error: "Teapot", message: "x" }),
      ).toBe("Could not complete the file operation. Please try again.");
    });

    it("returns storage_generic when there's no status code", async () => {
      await i18n.changeLanguage("pt-BR");
      expect(translateStorageError({ message: "x" })).toBe(
        "Nao foi possivel completar a operacao com o arquivo. Tente novamente.",
      );
      expect(translateStorageError(null)).toBe(
        "Nao foi possivel completar a operacao com o arquivo. Tente novamente.",
      );
    });
  });

  describe("schema leak guard", () => {
    it("NEVER leaks bucket names or path info for 404 errors", async () => {
      await i18n.changeLanguage("en");
      const leakyError = {
        statusCode: "404",
        error: "Not Found",
        message: 'The resource was not found in bucket "products-covers"',
      };
      const result = translateStorageError(leakyError);
      assertNoSchemaLeak(result);
      expect(result).not.toContain("products-covers");
    });

    it("NEVER leaks RLS policy details for 403 errors", async () => {
      await i18n.changeLanguage("en");
      const leakyError = {
        statusCode: "403",
        error: "Forbidden",
        message:
          'new row violates row-level security policy for table "storage.objects"',
      };
      const result = translateStorageError(leakyError);
      assertNoSchemaLeak(result);
      expect(result).not.toContain("storage.objects");
    });

    it("NEVER leaks even for unknown statusCode with loaded message", async () => {
      await i18n.changeLanguage("en");
      const leakyError = {
        statusCode: "999",
        error: "Unknown",
        message:
          "permission denied for table storage.objects on bucket user-uploads",
      };
      const result = translateStorageError(leakyError);
      assertNoSchemaLeak(result);
      expect(result).not.toContain("user-uploads");
      expect(result).not.toContain("storage.objects");
    });
  });
});

describe("isStorageError", () => {
  it("returns true for objects with statusCode + error", () => {
    expect(isStorageError({ statusCode: "404", error: "Not Found" })).toBe(true);
    expect(isStorageError({ statusCode: 413, error: "Payload Too Large" })).toBe(true);
  });

  it("returns false for objects missing statusCode", () => {
    expect(isStorageError({ error: "Not Found" })).toBe(false);
    expect(isStorageError({ message: "Not Found" })).toBe(false);
  });

  it("returns false for objects missing error field", () => {
    expect(isStorageError({ statusCode: "404" })).toBe(false);
    expect(isStorageError({ statusCode: "404", message: "x" })).toBe(false);
  });

  it("returns false for PostgrestError shape (code-based, no statusCode)", () => {
    expect(isStorageError({ code: "23505", message: "x" })).toBe(false);
  });

  it("returns false for null/undefined/primitives", () => {
    expect(isStorageError(null)).toBe(false);
    expect(isStorageError(undefined)).toBe(false);
    expect(isStorageError("string")).toBe(false);
  });
});
