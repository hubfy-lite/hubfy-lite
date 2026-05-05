/**
 * Languages supported for AI-generated output.
 *
 * The UI supports only pt-BR, en, es, but generation supports a wider set so
 * a Brazilian creator can produce courses in French, German, etc.
 */

import i18n from "@/i18n";

export const AI_LANGUAGES = [
  { code: "pt-BR", labelKey: "aiGen.languages.ptBR" },
  { code: "en", labelKey: "aiGen.languages.en" },
  { code: "es", labelKey: "aiGen.languages.es" },
  { code: "fr", labelKey: "aiGen.languages.fr" },
  { code: "de", labelKey: "aiGen.languages.de" },
  { code: "it", labelKey: "aiGen.languages.it" },
] as const;

export type AILanguageCode = (typeof AI_LANGUAGES)[number]["code"];

const VALID_CODES = new Set<string>(AI_LANGUAGES.map((l) => l.code));

/**
 * Returns the best default AI output language based on the user's current UI
 * locale. Falls back to pt-BR if we can't map.
 */
export function getDefaultAILanguage(): AILanguageCode {
  const current = i18n.language;
  if (current && VALID_CODES.has(current)) return current as AILanguageCode;

  // i18n may return a short code like "en-US" — normalize
  if (current?.startsWith("pt")) return "pt-BR";
  if (current?.startsWith("en")) return "en";
  if (current?.startsWith("es")) return "es";
  if (current?.startsWith("fr")) return "fr";
  if (current?.startsWith("de")) return "de";
  if (current?.startsWith("it")) return "it";

  return "pt-BR";
}
