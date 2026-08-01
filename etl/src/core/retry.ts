import { isRetryable } from './errors.js';

export interface RetryOptions {
  /** Total attempts (including the first). */
  attempts: number;
  /** Base backoff in ms; doubles each attempt. */
  baseBackoffMs: number;
  /** Upper bound on backoff in ms. */
  maxBackoffMs: number;
  /** Override the retry decision (default: retry ETLError with retryable: true). */
  retryable?: (error: unknown) => boolean;
  /** Called before sleeping, once per retry. */
  onRetry?: (error: unknown, attempt: number) => void;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Runs `fn`, retrying when it throws a retryable error. Backoff is exponential
 * (`base * 2^(attempt-1)`) capped at `maxBackoffMs`, with full jitter
 * (0.5x..1x) to avoid thundering herds. Throws the last error once attempts
 * are exhausted.
 */
export async function withRetry<T>(fn: () => Promise<T>, options: RetryOptions): Promise<T> {
  const { attempts, baseBackoffMs, maxBackoffMs } = options;
  const retryable = options.retryable ?? isRetryable;

  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt === attempts || !retryable(error)) throw error;
      const base = Math.min(baseBackoffMs * 2 ** (attempt - 1), maxBackoffMs);
      const backoff = base / 2 + Math.random() * (base / 2);
      options.onRetry?.(error, attempt);
      await sleep(backoff);
    }
  }
  throw lastError;
}
