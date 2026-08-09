import { neon } from '@neondatabase/serverless';
import type { Bindings } from '../config';

/** A row returned by the database (column → value). */
export type Row = Record<string, unknown>;

/** Minimal queryable surface the routes need (satisfied by the Neon client). */
export interface Db {
  query(sql: string, params?: unknown[]): Promise<Row[]>;
}

/**
 * Builds a Neon query client from the `DATABASE_URL` binding. Returns undefined
 * when no connection string is configured, so tests can run without a database
 * and environments can opt out.
 */
export function createDb(bindings: Bindings): Db | undefined {
  const url = typeof bindings.DATABASE_URL === 'string' ? bindings.DATABASE_URL : undefined;
  if (!url) return undefined;
  const sql = neon(url) as unknown as (text: string, params: unknown[]) => Promise<Row[]>;
  return {
    async query(text: string, params: unknown[] = []): Promise<Row[]> {
      return sql(text, params);
    },
  };
}
