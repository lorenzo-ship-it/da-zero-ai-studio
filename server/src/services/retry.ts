export const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function retryWithBackoff<T>(fn: () => Promise<T>, attempts = 3) {
  let delay = 250;
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt === attempts - 1) break;
      const jitter = Math.random() * 100;
      await wait(delay + jitter);
      delay *= 2;
    }
  }
  throw lastError;
}
