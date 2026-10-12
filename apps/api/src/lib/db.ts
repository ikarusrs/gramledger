import { neon } from '@neondatabase/serverless';
import type { Bindings } from '../config';

/** A row returned by the database (column → value). */
export type Row = Record<string, unknown>;

/** Minimal queryable surface the routes need (satisfied by the Postgres client). */
export interface Db {
  query(sql: string, params?: unknown[]): Promise<Row[]>;
}

/**
 * Builds a postgres.js client from the `DATABASE_URL` binding. Works both on
 * Cloudflare Workers (postgres.js supports the Workers runtime) and against a
 * local Postgres in dev. Returns undefined when no connection string is set,
 * so tests can run without a database.
 */
export function createDb(bindings: Bindings): Db | undefined {
  const url = typeof bindings.DATABASE_URL === 'string' ? bindings.DATABASE_URL : undefined;
  if (!url) return undefined;
  const sql = neon(url);
  return {
    async query(text: string, params: unknown[] = []): Promise<Row[]> {
      return (await sql.query(text, params)) as unknown as Row[];
    },
  };
}
