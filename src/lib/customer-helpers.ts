/**
 * Shared helpers for customer form logic.
 * Used by CustomerSheet (create/edit) and AdminCustomerDetail (full page edit).
 */

export const ALLOWED_DOCUMENT_TYPES = ["CPF", "CNPJ", "PASSPORT", "DNI", "ID", "RUT", "EIN", "VAT"] as const;

export function splitFullName(fullName?: string | null): { firstName: string; lastName: string } {
  const normalized = (fullName || "").trim().replace(/\s+/g, " ");
  if (!normalized) return { firstName: "", lastName: "" };
  const [firstName, ...rest] = normalized.split(" ");
  return { firstName: firstName || "", lastName: rest.join(" ").trim() };
}

export function buildFullName(firstName: string, lastName: string): string {
  return [firstName.trim(), lastName.trim()].filter(Boolean).join(" ").trim();
}

export function isValidDocumentType(
  docType: string,
): docType is (typeof ALLOWED_DOCUMENT_TYPES)[number] {
  return ALLOWED_DOCUMENT_TYPES.includes(
    docType as (typeof ALLOWED_DOCUMENT_TYPES)[number],
  );
}
