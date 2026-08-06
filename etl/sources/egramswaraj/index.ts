import {
  createPipeline,
  type Pipeline,
  type PipelineDeps,
  type PipelineStages,
} from '../../src/core/pipeline.js';
import type { Config } from '../../src/core/types.js';
import { ETLError } from '../../src/core/errors.js';
import {
  createPostgresAuditSink,
  createUpsertLoader,
  type Queryable,
} from '../../src/sinks/postgres.js';
import { FileDeadLetterSink } from '../../src/sinks/dead-letter.js';
import { createEGramSwarajFetcher, type CrawlOptions } from './client.js';
import { loadEGramSwarajConfig } from './config.js';
import { createResolvingTransform, deduplicate, normalize, validate } from './stages.js';
import { parseContent } from './parser.js';
import { createIdentityResolver, type IdentityResolver } from './resolver.js';
import type { EGramRecord, EGramSwarajConfig } from './types.js';

export const FINANCIAL_STATEMENTS_TABLE = 'financial_statements';

/** Natural key of `financial_statements` (see the migration). */
export const FINANCIAL_STATEMENTS_KEY = ['panchayat_id', 'fy', 'period', 'source'] as const;

export const FINANCIAL_STATEMENTS_COLUMNS = [
  'panchayat_id',
  'fy',
  'period',
  'month_no',
  'receipts',
  'receipt_cancellation',
  'ob_cancellation',
  'payments',
  'payment_cancellation',
  'opening_balance',
  'source',
] as const;

export interface EGramPipelineDeps {
  sourceConfig: EGramSwarajConfig;
  pipeline: PipelineDeps;
  /** Postgres pool for identity resolution + the upsert loader. */
  pool: Queryable;
  /** Override the DB identity resolver (tests). */
  resolve?: IdentityResolver;
  /** Override the HTTP fetch / rate-limit sleep (tests). */
  fetch?: CrawlOptions;
}

export function buildEGramSwarajPipeline(deps: EGramPipelineDeps): Pipeline {
  const { pool } = deps;
  const resolve = deps.resolve ?? createIdentityResolver(pool);

  const stages: PipelineStages<EGramRecord> = {
    fetch: createEGramSwarajFetcher(deps.sourceConfig, deps.fetch),
    parse: parseContent,
    validate,
    normalize,
    deduplicate,
    transform: createResolvingTransform(resolve),
    load: createUpsertLoader<EGramRecord>({
      pool,
      table: FINANCIAL_STATEMENTS_TABLE,
      conflictColumns: [...FINANCIAL_STATEMENTS_KEY],
      columns: [...FINANCIAL_STATEMENTS_COLUMNS],
      map: (record) => {
        if (record.panchayatId === undefined) {
          throw new ETLError('LOAD_ERROR', 'valid record is missing panchayatId');
        }
        return {
          panchayat_id: record.panchayatId,
          fy: record.financialYear,
          period: record.period,
          month_no: record.monthNo ?? null,
          receipts: record.receipts ?? 0,
          receipt_cancellation: record.receiptCancellation ?? 0,
          ob_cancellation: record.obCancellation ?? 0,
          payments: record.payments ?? 0,
          payment_cancellation: record.paymentCancellation ?? 0,
          opening_balance: record.openingBalance ?? null,
          source: record.source,
        };
      },
    }),
  };

  return createPipeline('egramswaraj', stages, deps.pipeline);
}

/**
 * Runs the source end-to-end against Postgres (crawl → load → audit). Used by
 * the scheduled runner; for a pilot set `sourceConfig.reportUrls` to a single
 * district report URL.
 */
export async function runEGramSwaraj(
  config: Config,
  sourceConfig: EGramSwarajConfig,
  pool: Queryable,
): Promise<ReturnType<Pipeline['run']>> {
  const pipeline = buildEGramSwarajPipeline({
    sourceConfig,
    pool,
    pipeline: {
      config,
      deadLetter: new FileDeadLetterSink({ dir: config.deadLetterDir }),
      audit: createPostgresAuditSink({ pool }),
    },
  });
  return pipeline.run();
}

export { loadEGramSwarajConfig };
export * from './types.js';
export * from './html.js';
export * from './parser.js';
export * from './stages.js';
export * from './resolver.js';
export * from './client.js';
