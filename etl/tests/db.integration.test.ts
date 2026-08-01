import { describe, expect, it } from 'vitest';
import type { RunReport } from '../src/core/types.js';
import { createPool, createPostgresAuditSink, createUpsertLoader } from '../src/sinks/postgres.js';
import { testCtx } from './helpers.js';

const url = process.env.DATABASE_URL;
const run = describe.skipIf(!url);

run('postgres sinks (integration)', () => {
  it('upserts rows and persists a run audit', async () => {
    const pool = createPool({ databaseUrl: url! });
    try {
      await pool.query('DROP TABLE IF EXISTS etl_int_prices');
      await pool.query(
        'CREATE TABLE etl_int_prices (market text, commodity text, price numeric(12,2), PRIMARY KEY (market, commodity))',
      );

      const loader = createUpsertLoader({
        pool,
        table: 'etl_int_prices',
        conflictColumns: ['market', 'commodity'],
      });

      const first = await loader(
        [
          { market: 'Pune', commodity: 'Onion', price: 1500 },
          { market: 'Satara', commodity: 'Potato', price: 900 },
        ],
        testCtx(),
      );
      expect(first.upserted).toBe(2);

      const second = await loader(
        [
          { market: 'Pune', commodity: 'Onion', price: 1550 },
          { market: 'Kolhapur', commodity: 'Onion', price: 1600 },
        ],
        testCtx(),
      );
      expect(second.upserted).toBe(2);

      const { rows } = await pool.query(
        'SELECT market, commodity, price FROM etl_int_prices ORDER BY market',
      );
      expect(rows).toEqual([
        { market: 'Kolhapur', commodity: 'Onion', price: '1600.00' },
        { market: 'Pune', commodity: 'Onion', price: '1550.00' },
        { market: 'Satara', commodity: 'Potato', price: '900.00' },
      ]);

      const audit = createPostgresAuditSink({ pool });
      const startedAt = new Date().toISOString();
      const finishedAt = new Date().toISOString();
      const report: RunReport = {
        source: 'agmarknet',
        status: 'success',
        startedAt,
        finishedAt,
        durationMs: 3,
        retryCount: 0,
        counts: {
          rowsSeen: 3,
          rowsUpserted: 2,
          rowsSkipped: 0,
          rowsFailed: 1,
          duplicatesRemoved: 0,
          validationFailures: 1,
        },
        warnings: ['sample'],
        errors: [],
      };
      await audit.record(report);

      const audited = await pool.query(
        "SELECT * FROM ingestion_runs WHERE source = 'agmarknet' ORDER BY started_at DESC LIMIT 1",
      );
      expect(audited.rowCount).toBe(1);
      const row = audited.rows[0];
      expect(row.source).toBe('agmarknet');
      expect(row.status).toBe('success');
      expect(row.rows_seen).toBe(3);
      expect(row.rows_upserted).toBe(2);
      expect(row.rows_failed).toBe(1);
      expect(row.duplicates_removed).toBe(0);
      expect(row.validation_failures).toBe(1);
      expect(row.retry_count).toBe(0);
      expect(row.warnings).toEqual(['sample']);

      await pool.query("DELETE FROM ingestion_runs WHERE source = 'agmarknet'");
    } finally {
      await pool.query('DROP TABLE IF EXISTS etl_int_prices');
      await pool.end();
    }
  });
});
