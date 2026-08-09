import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ETLError } from '../src/core/errors.js';
import { createSnapshotSink, FileObjectStore } from '../src/sinks/snapshot.js';
import type { Queryable } from '../src/sinks/postgres.js';

function memoryPool() {
  const calls: { sql: string; params: unknown[] }[] = [];
  const query = async (sql: string, params: unknown[] = []) => {
    calls.push({ sql, params });
    return { rows: [] };
  };
  return { pool: { query } as unknown as Queryable, calls };
}

describe('snapshot sink', () => {
  let dir: string;
  const { pool, calls } = memoryPool();

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'etl-snapshot-'));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
    calls.length = 0;
  });

  it('writes the payload to the object store and records the row', async () => {
    const store = new FileObjectStore(dir);
    const sink = createSnapshotSink({ pool, store });

    const key = await sink.snapshot('lgd', { villages: 19202 });

    expect(key).toBeTruthy();
    const files = readdirSync(dir);
    expect(files).toEqual([key]);
    expect(JSON.parse(readFileSync(join(dir, key), 'utf8'))).toEqual({ villages: 19202 });
    expect(calls).toEqual([
      {
        sql: `INSERT INTO ingestion_snapshots (source, s3_key) VALUES ($1, $2)`,
        params: ['lgd', key],
      },
    ]);
  });

  it('records a supplied key instead of generating one', async () => {
    const sink = createSnapshotSink({ pool, store: new FileObjectStore(dir) });
    const key = await sink.snapshot('lgd', { rows: 1 }, 'snapshots/lgd-rebuild-2026.json');
    expect(key).toBe('snapshots/lgd-rebuild-2026.json');
    expect(readdirSync(dir)).toEqual(['snapshots']);
  });

  it('rejects an invalid table name', () => {
    expect(() =>
      createSnapshotSink({ pool, store: new FileObjectStore(dir), table: 'bad name' }),
    ).toThrow(ETLError);
  });
});
