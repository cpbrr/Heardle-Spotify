import { AppError } from './authClient';

const DEFAULT_RETRY_DELAY_MS = 500;
const DEFAULT_MAX_RETRIES = 2;

interface WithRetryOptions {
  maxRetries?: number;
  delay?: (ms: number) => Promise<void>;
}

function defaultDelay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function withRetry<T>(fn: () => Promise<T>, options: WithRetryOptions = {}): Promise<T> {
  const maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
  const delay = options.delay ?? defaultDelay;

  let attempt = 0;
  for (;;) {
    try {
      return await fn();
    } catch (error) {
      if (!(error instanceof AppError) || !error.retryable || attempt >= maxRetries) {
        throw error;
      }
      await delay(error.retryAfterMs || DEFAULT_RETRY_DELAY_MS);
      attempt += 1;
    }
  }
}
