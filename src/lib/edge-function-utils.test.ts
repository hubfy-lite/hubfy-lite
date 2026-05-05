import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock the supabase client because edge-function-utils imports it at the top.
// We never actually call supabase.functions.invoke in these tests — only the
// pure helpers (translateEdgeError, parseEdgeFunctionError, isNonRetryable).
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: {
      invoke: vi.fn(),
    },
  },
}));

import i18n from "@/i18n";
import {
  isNonRetryable,
  parseEdgeFunctionError,
  translateEdgeError,
} from "@/lib/edge-function-utils";

describe("translateEdgeError", () => {
  const originalLanguage = i18n.language;

  afterEach(async () => {
    await i18n.changeLanguage(originalLanguage);
  });

  describe("code resolution", () => {
    beforeEach(async () => {
      await i18n.changeLanguage("pt-BR");
    });

    it("translates direct .code to the localized message", () => {
      const err = Object.assign(new Error("backend raw msg"), {
        code: "customer_already_exists",
      });
      expect(translateEdgeError(err)).toBe(
        "Este email ja e cliente deste workspace.",
      );
    });

    it("reads .code from ._body when not set on the error itself", () => {
      const err = Object.assign(new Error("backend raw msg"), {
        _body: { code: "rate_limited" },
      });
      expect(translateEdgeError(err)).toBe(
        "Muitas tentativas. Aguarde alguns instantes e tente novamente.",
      );
    });

    it("reads ._body.error_code as a fallback (SCREAMING_SNAKE input)", () => {
      const err = Object.assign(new Error("backend raw msg"), {
        _body: { error_code: "RATE_LIMIT_EMAIL" },
      });
      expect(translateEdgeError(err)).toBe(
        "Acabamos de enviar um email. Aguarde 1 minuto antes de tentar novamente.",
      );
    });

    it("normalizes SCREAMING_SNAKE to snake_case before lookup", () => {
      const err = Object.assign(new Error("raw"), {
        code: "TEMPORARY_UNAVAILABLE",
      });
      expect(translateEdgeError(err)).toBe(
        "Servico temporariamente indisponivel. Tente novamente em instantes.",
      );
    });

    it("normalizes kebab-case to snake_case before lookup", () => {
      const err = Object.assign(new Error("raw"), { code: "rate-limited" });
      expect(translateEdgeError(err)).toBe(
        "Muitas tentativas. Aguarde alguns instantes e tente novamente.",
      );
    });
  });

  describe("fallback behavior", () => {
    beforeEach(async () => {
      await i18n.changeLanguage("pt-BR");
    });

    it("falls back to err.message when code has no translation", () => {
      const err = Object.assign(new Error("Raw backend message"), {
        code: "definitely_not_a_real_code",
      });
      expect(translateEdgeError(err)).toBe("Raw backend message");
    });

    it("falls back to err.message when there is no code at all", () => {
      const err = new Error("Just a plain error");
      expect(translateEdgeError(err)).toBe("Just a plain error");
    });

    it("uses edgeErrors._fallback when error has neither code nor message", () => {
      expect(translateEdgeError({})).toBe("Algo deu errado. Tente novamente.");
    });

    it("uses edgeErrors._fallback when error is null/undefined", () => {
      expect(translateEdgeError(null)).toBe("Algo deu errado. Tente novamente.");
      expect(translateEdgeError(undefined)).toBe(
        "Algo deu errado. Tente novamente.",
      );
    });
  });

  describe("cross-locale support", () => {
    it("returns English translation when language is 'en'", async () => {
      await i18n.changeLanguage("en");
      const err = Object.assign(new Error("raw"), {
        code: "customer_already_exists",
      });
      expect(translateEdgeError(err)).toBe(
        "This email is already a customer in this workspace.",
      );
    });

    it("returns Spanish translation when language is 'es'", async () => {
      await i18n.changeLanguage("es");
      const err = Object.assign(new Error("raw"), {
        code: "customer_already_exists",
      });
      expect(translateEdgeError(err)).toBe(
        "Este correo ya es cliente de este workspace.",
      );
    });

    it("returns the _fallback in the active language", async () => {
      await i18n.changeLanguage("en");
      expect(translateEdgeError({})).toBe(
        "Something went wrong. Please try again.",
      );

      await i18n.changeLanguage("es");
      expect(translateEdgeError({})).toBe("Algo salio mal. Intentalo de nuevo.");
    });
  });
});

describe("parseEdgeFunctionError", () => {
  it("extracts code, status, and translated message from enriched error", async () => {
    await i18n.changeLanguage("pt-BR");
    const err = Object.assign(new Error("backend raw"), {
      code: "integration_not_found",
      status: 404,
      _body: { code: "integration_not_found" },
    });
    const parsed = parseEdgeFunctionError(err);
    expect(parsed.code).toBe("integration_not_found");
    expect(parsed.status).toBe(404);
    expect(parsed.message).toBe("Integracao nao encontrada.");
  });

  it("returns a message even when given a plain Error without code", () => {
    const err = new Error("Plain error");
    const parsed = parseEdgeFunctionError(err);
    expect(parsed.code).toBeUndefined();
    expect(parsed.message).toBe("Plain error");
  });
});

describe("isNonRetryable", () => {
  it("returns true for known non-retryable codes", () => {
    const err = Object.assign(new Error("raw"), {
      code: "vimeo_api_error",
      _body: { code: "vimeo_api_error" },
    });
    expect(isNonRetryable(err)).toBe(true);
  });

  it("returns false for unknown codes", () => {
    const err = Object.assign(new Error("raw"), { code: "some_other_error" });
    expect(isNonRetryable(err)).toBe(false);
  });

  it("returns false when there is no code", () => {
    expect(isNonRetryable(new Error("plain"))).toBe(false);
  });
});
