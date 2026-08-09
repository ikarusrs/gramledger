import { describe, expect, it } from 'vitest';
import { loadConfig } from '../src/core/config.js';
import { createPool } from '../src/sinks/postgres.js';
import { loadLgdConfig } from '../sources/lgd/config.js';
import { runLgd } from '../sources/lgd/index.js';

/**
 * Sample importer: runs the LGD source against Postgres with a real resource.
 * Opt-in (`ETL_LGD_RUN_INTEGRATION=1`) so routine `npm test` never hits the
 * network or requires credentials:
 *
 *   ETL_LGD_RUN_INTEGRATION=1 DATABASE_URL=… ETL_LGD_RESOURCE_ID=… npm test
 *
 * Requires the hierarchy tables (run `npm run db:migrate`). The run upserts
 * states/districts/talukas/panchayats/villages from the first pages only, so
 * it is a schema smoke test, not a full national load.
 */
const enabled = process.env.ETL_LGD_RUN_INTEGRATION === '1';
const run = describe.skipIf(!enabled);

run('LGD source (integration)', () => {
  it('ingests hierarchy rows and audits the run', async () => {
    const config = loadConfig();
    const sourceConfig = loadLgdConfig();
    const pool = createPool(config);
    try {
      const report = await runLgd(config, sourceConfig, pool);
      expect(['success', 'partial']).toContain(report.status);
      expect(report.counts.rowsSeen).toBeGreaterThan(0);

      const { rows } = await pool.query(
        'SELECT COUNT(*)::int AS n FROM villages WHERE lgd_code IS NOT NULL',
      );
      expect(Number(rows[0]?.n)).toBeGreaterThan(0);
    } finally {
      await pool.end();
    }
  });
});
