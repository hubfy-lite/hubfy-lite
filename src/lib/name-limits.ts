export const FRONTEND_NAME_MAX_LENGTH = 100;

export function limitNameLength(
  value: string,
  maxLength = FRONTEND_NAME_MAX_LENGTH
): string {
  return value.slice(0, maxLength);
}

export function limitOptionalNameLength(
  value: string | null | undefined,
  maxLength = FRONTEND_NAME_MAX_LENGTH
): string | null {
  if (value == null) return null;
  return limitNameLength(value, maxLength);
}
