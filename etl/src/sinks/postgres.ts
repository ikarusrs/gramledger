import { Pool } from 'pg';
import type { AuditSink, Config, ETLRecord, Loader, LoadResult } from '../core/types.js';
import { ETLError } from '../core/errors.js';

/** The minimal queryable surface the sinks need (satisfied by `Pool`). */
export type Queryable = Pick<Pool, 'query'>;

/** Validates a SQL identifier (table/column) that is interpolated into SQL. */
function assertIdentifier(name: string, kind: 'table' | 'column'): string {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
    throw new ETLError('CONFIG_ERROR', `Invalid ${kind} identifier: ${name}`);
  }
  return name;
}

/** Creates a Postgres connection pool from ETL config. */
export function createPool(config: Pick<Config, 'databaseUrl'>): Pool {
  if (!config.databaseUrl) {
    throw new ETLError('CONFIG_ERROR', 'DATABASE_URL is required for Postgres sinks');
  }
  return new Pool({ connectionString: config.databaseUrl });
}

// ---------------------------------------------------------------------------
// Audit sink
// ---------------------------------------------------------------------------

export interface PostgresAuditSinkOptions {
  pool: Queryable;
  /** Defaults to `ingestion_runs`. */
  table?: string;
}

/**
 * Persists a `RunReport` into the `ingestion_runs` audit table (see the
 * `database/etl-audit-columns` migration for the extra columns).
 */
export function createPostgresAuditSink(options: PostgresAuditSinkOptions): AuditSink {
  const table = assertIdentifier(options.table ?? 'ingestion_runs', 'table');
  return {
    async record(run): Promise<void> {
      const sql = `
        INSERT INTO ${table}
          (source, status, rows_seen, rows_upserted, rows_skipped, rows_failed,
           duplicates_removed, validation_failures, retry_count, warnings, errors, started_at, finished_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      `;
      await options.pool.query(sql, [
        run.source,
        run.status,
        run.counts.rowsSeen,
        run.counts.rowsUpserted,
        run.counts.rowsSkipped,
        run.counts.rowsFailed,
        run.counts.duplicatesRemoved,
        run.counts.validationFailures,
        run.retryCount,
        JSON.stringify(run.warnings),
        JSON.stringify(run.errors),
        run.startedAt,
        run.finishedAt,
      ]);
    },
  };
}

// ---------------------------------------------------------------------------
// Generic upsert loader
// ---------------------------------------------------------------------------

export interface UpsertLoaderOptions<TRecord extends ETLRecord = ETLRecord> {
  pool: Queryable;
  table: string;
  /** Natural-key columns for `ON CONFLICT (…)`. */
  conflictColumns: string[];
  /** Optional column allowlist; defaults to the union of record keys. */
  columns?: string[];
  /** Optional record → row mapper (replaces the default identity mapping). */
  map?: (record: TRecord) => Record<string, unknown>;
}

/**
 * Builds a `Loader` that upserts batches into a Postgres table with
 * `INSERT … ON CONFLICT (natural key) DO UPDATE`, one statement per batch
 * (a single implicit transaction, per PLANNING.md §7). Row values must be
 * JSON-serializable; objects/arrays are stored as JSONB.
 */
export function createUpsertLoader<TRecord extends ETLRecord = ETLRecord>(
  options: UpsertLoaderOptions<TRecord>,
): Loader<TRecord> {
  const { pool, conflictColumns } = options;
  const table = assertIdentifier(options.table, 'table');
  conflictColumns.forEach((col) => assertIdentifier(col, 'column'));

  return async (records): Promise<LoadResult> => {
    if (records.length === 0) return { upserted: 0, inserted: 0, updated: 0 };

    const rows = records.map((r) => (options.map ? options.map(r) : r));
    const columns = options.columns ?? unionKeys(rows);
    columns.forEach((col) => assertIdentifier(col, 'column'));

    const conflictList = conflictColumns.join(', ');
    const columnList = columns.join(', ');
    const updateColumns = columns.filter((col) => !conflictColumns.includes(col));
    const onConflict =
      updateColumns.length === 0
        ? `ON CONFLICT (${conflictList}) DO NOTHING`
        : `ON CONFLICT (${conflictList}) DO UPDATE SET ${updateColumns
            .map((col) => `${col} = EXCLUDED.${col}`)
            .join(', ')}`;

    const tuples: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;
    for (const row of rows) {
      const tuple = columns.map((col) => {
        const value = row[col];
        params.push(value === undefined ? null : normalizeValue(value));
        return `$${paramIndex++}`;
      });
      tuples.push(`(${tuple.join(', ')})`);
    }

    const valuesSql = tuples.join(', ');
    const sql = `
      INSERT INTO ${table} (${columnList}) VALUES ${valuesSql}
      ${onConflict}
    `;

    const result = await pool.query(sql, params);
    const rowCount = result.rowCount ?? 0;
    return { upserted: rowCount, inserted: rowCount, updated: rowCount };
  };
}

function unionKeys(rows: Record<string, unknown>[]): string[] {
  const seen = new Set<string>();
  for (const row of rows) {
    for (const key of Object.keys(row)) seen.add(key);
  }
  return [...seen];
}

/** Objects/arrays serialize to JSON strings (JSONB columns); everything else passes through. */
function normalizeValue(value: unknown): unknown {
  if (value !== null && typeof value === 'object') return JSON.stringify(value);
  return value;
}
