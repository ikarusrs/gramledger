import { loadConfig } from './core/config.js';
import type { EnvLike } from './core/config.js';
import { createLogger } from './core/logger.js';
import { ETLError } from './core/errors.js';
import type { Config, RunReport } from './core/types.js';
import { createPool, type Queryable } from './sinks/postgres.js';
import { loadLgdConfig } from '../sources/lgd/config.js';
import { runLgd } from '../sources/lgd/index.js';
import { loadDataGovInConfig } from '../sources/data_gov_in/config.js';
import { runDataGovIn } from '../sources/data_gov_in/index.js';
import { loadEGramSwarajConfig } from '../sources/egramswaraj/config.js';
import { runEGramSwaraj } from '../sources/egramswaraj/index.js';

const KNOWN_SOURCES = ['lgd', 'data_gov_in', 'egramswaraj'] as const;
export type SourceName = (typeof KNOWN_SOURCES)[number];

/**
 * Runs the requested source end-to-end (fetch → load → audit). Picks the
 * source via `ETL_SOURCE` and loads that source's config from the same env,
 * so the scheduled runner only needs `DATABASE_URL` plus the `ETL_*`
 * variables (each source's config documents the required ones).
 *
 * Exit codes: 0 success, 2 partial, 1 failure or misconfiguration.
 */
export async function main(env: EnvLike = process.env, source?: string): Promise<number> {
  const config = loadConfig(env);
  const logger = createLogger({ level: config.logLevel });
  const name = (source ?? env.ETL_SOURCE ?? '').trim();

  if (!name) {
    logger.error('ETL_SOURCE is required');
    return 1;
  }
  if (!KNOWN_SOURCES.includes(name as SourceName)) {
    throw new ETLError('CONFIG_ERROR', `Unknown ETL_SOURCE '${name}'`, {
      details: { known: [...KNOWN_SOURCES] },
    });
  }
  if (!config.databaseUrl) {
    logger.error('DATABASE_URL is required for the ETL runner');
    return 1;
  }

  const pool = createPool(config);
  let report: RunReport;
  try {
    report = await dispatch(name as SourceName, env, config, pool);
  } catch (err) {
    logger.error(`run failed for ${name}`, {
      error: err instanceof Error ? err.message : String(err),
    });
    return 1;
  } finally {
    await pool.end().catch(() => undefined);
  }

  logger.info(`run ${name}: ${report.status}`, report.counts);
  for (const warning of report.warnings) logger.warn(warning);
  process.stdout.write(`${JSON.stringify(report)}\n`);

  return report.status === 'failed' ? 1 : report.status === 'partial' ? 2 : 0;
}

/** Forks to the source implementation, loading its config from env. */
export async function dispatch(
  source: SourceName,
  env: EnvLike,
  config: Config,
  pool: Queryable,
): Promise<RunReport> {
  switch (source) {
    case 'lgd':
      return await runLgd(config, loadLgdConfig(env), pool);
    case 'data_gov_in':
      return await runDataGovIn(config, loadDataGovInConfig(env), pool);
    case 'egramswaraj':
      return await runEGramSwaraj(config, loadEGramSwarajConfig(env), pool);
    default:
      throw new ETLError('CONFIG_ERROR', `Unknown ETL_SOURCE '${source}'`);
  }
}

if (process.env.NODE_ENV !== 'test') {
  main().then(
    (code) => {
      process.exitCode = code;
    },
    (err) => {
      console.error(err instanceof Error ? err.message : String(err));
      process.exitCode = 1;
    },
  );
}
