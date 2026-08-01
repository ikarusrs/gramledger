import { describe, expect, it } from 'vitest';
import { withRetry, sleep } from '../src/core/retry.js';
import { ETLError } from '../src/core/errors.js';

describe('sleep', () => {
  it('resolves after roughly the requested ms', async () => {
    const start = Date.now();
    await sleep(20);
    expect(Date.now() - start).toBeGreaterThanOrEqual(15);
  });
});

describe('withRetry', () => {
  it('retries on retryable errors and succeeds', async () => {
    let attempts = 0;
    const result = await withRetry(
      async () => {
        attempts++;
        if (attempts < 3) throw new ETLError('FETCH_ERROR', 'flaky', { retryable: true });
        return 'ok';
      },
      { attempts: 5, baseBackoffMs: 1, maxBackoffMs: 2 },
    );
    expect(result).toBe('ok');
    expect(attempts).toBe(3);
  });

  it('does not retry non-retryable errors', async () => {
    const attempts: number[] = [];
    const error = new ETLError('CONFIG_ERROR', 'bad');
    await expect(
      withRetry(
        async () => {
          attempts.push(1);
          throw error;
        },
        { attempts: 3, baseBackoffMs: 1, maxBackoffMs: 2 },
      ),
    ).rejects.toBe(error);
    expect(attempts).toHaveLength(1);
  });

  it('gives up after max attempts', async () => {
    let attempts = 0;
    await expect(
      withRetry(
        async () => {
          attempts++;
          throw new ETLError('FETCH_ERROR', 'nope', { retryable: true });
        },
        { attempts: 4, baseBackoffMs: 1, maxBackoffMs: 2 },
      ),
    ).rejects.toMatchObject({ code: 'FETCH_ERROR', retryable: true });
    expect(attempts).toBe(4);
  });
});
