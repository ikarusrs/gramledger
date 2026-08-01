import { describe, expect, it } from 'vitest';
import { loadConfig } from '../src/core/config.js';
import { createPool } from '../src/sinks/postgres.js';
import { loadDataGovInConfig } from '../sources/data_gov_in/config.js';
import { runDataGovIn } from '../sources/data_gov_in/index.js';

/**
 * Sample importer: runs the data.gov.in Agmarknet source against Postgres with
 * the real API. Opt-in (`ETL_DGI_RUN_INTEGRATION=1`) so routine `npm test`
 * never hits the network or requires credentials:
 *
 *   ETL_DGI_RUN_INTEGRATION=1 DATABASE_URL=… ETL_DGI_API_KEY=… npm test
 *
 * Requires the `commodity_prices` table (run `npm run db:migrate`) and seeded
 * `districts` rows matching the API's district names.
 */
const enabled = process.env.ETL_DGI_RUN_INTEGRATION === '1';
const run = describe.skipIf(!enabled);

run('data.gov.in source (integration)', () => {
  it('ingests a day of mandi prices and audits the run', async () => {
    const config = loadConfig();
    const sourceConfig = loadDataGovInConfig();
    const pool = createPool(config);
    try {
      const report = await runDataGovIn(config, sourceConfig, pool);
      expect(['success', 'partial']).toContain(report.status);
      expect(report.counts.rowsSeen).toBeGreaterThan(0);

      const { rows } = await pool.query('SELECT COUNT(*)::int AS n FROM commodity_prices');
      expect(Number(rows[0]?.n)).toBeGreaterThan(0);
    } finally {
      await pool.end();
    }
  });
});
