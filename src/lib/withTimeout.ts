export class TimeoutError extends Error {
  name = "TimeoutError";
  constructor(message: string) {
    super(message);
  }
}

export async function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  message = "Tempo esgotado"
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new TimeoutError(message)), ms);
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}
