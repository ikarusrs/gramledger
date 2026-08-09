import { describe, expect, it } from 'vitest';
import { ETLError } from '../src/core/errors.js';
import { main } from '../src/cli.js';

describe('cli runner', () => {
  it('returns 1 when ETL_SOURCE is missing', async () => {
    await expect(main({ DATABASE_URL: 'postgres://x' })).resolves.toBe(1);
  });

  it('rejects an unknown source', async () => {
    const env = { DATABASE_URL: 'postgres://x' };
    await expect(main(env, 'womp')).rejects.toThrow(ETLError);
    await expect(main(env, 'womp')).rejects.toThrow(/Unknown ETL_SOURCE/);
  });
});
