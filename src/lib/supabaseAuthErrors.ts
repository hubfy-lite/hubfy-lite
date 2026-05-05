type AuthErrorLike = {
  code?: string;
  message?: string;
};

const SAME_PASSWORD_ERROR_CODE = "same_password";
const SAME_PASSWORD_ERROR_MESSAGES = [
  "new password should be different from the old password",
  "new password should be different from old password",
];

export const isSamePasswordAsCurrentError = (error: unknown): boolean => {
  if (!error || typeof error !== "object") {
    return false;
  }

  const { code, message } = error as AuthErrorLike;

  if (typeof code === "string" && code.toLowerCase() === SAME_PASSWORD_ERROR_CODE) {
    return true;
  }

  if (typeof message !== "string") {
    return false;
  }

  const normalizedMessage = message.toLowerCase();
  return SAME_PASSWORD_ERROR_MESSAGES.some((candidate) => normalizedMessage.includes(candidate));
};
