import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { ETLError } from '../core/errors.js';
import type { Queryable } from './postgres.js';

/**
 * Backendable storage for snapshots. The file store covers local/dev and
 * tests; an R2 (or S3-compatible) backend can implement the same interface
 * once bucket credentials exist (`openData.s3` in PLANNING §12).
 */
export interface ObjectStore {
  put(key: string, contents: string): Promise<void>;
  get(key: string): Promise<string | undefined>;
}

/** Writes snapshots as JSON files under a local directory. */
export class FileObjectStore implements ObjectStore {
  constructor(private readonly dir: string) {}

  async put(key: string, contents: string): Promise<void> {
    const target = path.join(this.dir, key);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, contents, 'utf8');
  }

  async get(key: string): Promise<string | undefined> {
    try {
      return await readFile(path.join(this.dir, key), 'utf8');
    } catch {
      return undefined;
    }
  }
}

export interface SnapshotSinkOptions {
  pool: Queryable;
  store: ObjectStore;
  /** Defaults to `ingestion_snapshots`. */
  table?: string;
}

/**
 * Stores a pre-overwrite snapshot of a source's data (per PLANNING.md §7) so a
 * destructive rebuild can be rolled back. Writes the payload to the object
 * store and records `(source, s3_key)` in `ingestion_snapshots` (taken_at
 * defaults to now).
 */
export function createSnapshotSink(options: SnapshotSinkOptions) {
  const table = options.table ?? 'ingestion_snapshots';
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(table)) {
    throw new ETLError('CONFIG_ERROR', `Invalid table identifier: ${table}`);
  }

  return {
    /**
     * Snapshots `payload` (any JSON-serializable value) under a generated key
     * and records it. Returns the object key.
     */
    async snapshot(source: string, payload: unknown, key?: string): Promise<string> {
      const usedKey = key ?? `${source}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
      await options.store.put(usedKey, JSON.stringify(payload));
      await options.pool.query(`INSERT INTO ${table} (source, s3_key) VALUES ($1, $2)`, [
        source,
        usedKey,
      ]);
      return usedKey;
    },
  };
}

export type SnapshotSink = ReturnType<typeof createSnapshotSink>;
