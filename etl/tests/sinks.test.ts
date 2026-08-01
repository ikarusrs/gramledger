import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ETLError } from '../src/core/errors.js';
import { FileDeadLetterSink, NullDeadLetterSink } from '../src/sinks/dead-letter.js';
import { createPool, createUpsertLoader } from '../src/sinks/postgres.js';
import type { Queryable } from '../src/sinks/postgres.js';
import { testCtx } from './helpers.js';

const fakePool = { query: async () => ({ rowCount: 1 }) } as unknown as Queryable;

describe('FileDeadLetterSink', () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'etl-dlq-'));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('writes records as JSONL with metadata on every line', async () => {
    const sink = new FileDeadLetterSink({ dir });
    await sink.write('markets', 'validate', 'validation failed', [
      { market: 'Pune', commodity: 'Onion', price: -5 },
    ]);

    const files = readdirSync(dir);
    expect(files).toHaveLength(1);
    expect(files[0]!).toMatch(/^markets-validate-\d{4}-\d{2}-\d{2}T[\d-]+Z-\d+\.jsonl$/);

    const lines = readFileSync(join(dir, files[0]!), 'utf8').trim().split('\n');
    expect(lines).toHaveLength(1);
    const entry = JSON.parse(lines[0]!) as Record<string, unknown>;
    expect(entry).toMatchObject({
      source: 'markets',
      stage: 'validate',
      reason: 'validation failed',
    });
    expect(entry.record).toEqual({ market: 'Pune', commodity: 'Onion', price: -5 });
  });

  it('appends subsequent writes to a new file', async () => {
    const sink = new FileDeadLetterSink({ dir });
    await sink.write('a', 'load', 'x', [{ id: 1 }]);
    await sink.write('a', 'load', 'x', [{ id: 2 }]);
    expect(readdirSync(dir)).toHaveLength(2);
  });
});

describe('NullDeadLetterSink', () => {
  it('is a no-op', async () => {
    const sink = NullDeadLetterSink();
    await expect(sink.write('a', 'validate', 'r', [{}])).resolves.toBeUndefined();
  });
});

describe('createUpsertLoader', () => {
  it('rejects invalid table identifiers', () => {
    expect(() =>
      createUpsertLoader({
        pool: fakePool,
        table: 'users; DROP TABLE users',
        conflictColumns: ['id'],
      }),
    ).toThrow(ETLError);
  });

  it('loads a batch with a valid schema', async () => {
    const loader = createUpsertLoader({
      pool: fakePool,
      table: 'prices',
      conflictColumns: ['market', 'commodity'],
    });
    const result = await loader([{ market: 'Pune', commodity: 'Onion', price: 1500 }], testCtx());
    expect(result.upserted).toBe(1);
  });
});

describe('createPool', () => {
  it('requires a DATABASE_URL', () => {
    expect(() => createPool({ databaseUrl: undefined })).toThrow(ETLError);
  });
});
