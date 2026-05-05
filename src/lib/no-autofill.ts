/**
 * Props para bloquear autocomplete de navegadores e extensões
 * (1Password, LastPass, Bitwarden, Chrome address autofill).
 *
 * Aplicar em inputs sensíveis: API keys, tokens, secrets, slugs,
 * credenciais, descrições — qualquer campo onde autofill é indesejável.
 *
 * Uso:
 *   <Input {...NO_AUTOFILL_PROPS} type="password" ... />
 */
export const NO_AUTOFILL_PROPS = {
  autoComplete: "off",
  "data-1p-ignore": "true",
  "data-lpignore": "true",
  "data-form-type": "other",
} as const;
