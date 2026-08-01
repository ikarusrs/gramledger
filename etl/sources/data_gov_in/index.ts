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
import { createFetcher } from './client.js';
import { createValidator } from './validate.js';
import { createDistrictResolver } from './resolver.js';
import { deduplicate, normalize, parseContent } from './mapping.js';
import type { DataGovInConfig, DistrictResolver, MandiPriceRecord } from './types.js';

export const PRICES_TABLE = 'commodity_prices';

/** Natural key of `commodity_prices`; the ON CONFLICT target. */
export const PRICES_NATURAL_KEY = [
  'district_lgd_code',
  'market',
  'commodity',
  'variety',
  'grade',
  'price_date',
] as const;

/** Row columns of `commodity_prices`. */
export const PRICES_COLUMNS = [
  'district_lgd_code',
  'market',
  'commodity',
  'variety',
  'grade',
  'min_price',
  'max_price',
  'modal_price',
  'price_date',
] as const;

export interface DataGovInPipelineDeps {
  sourceConfig: DataGovInConfig;
  pool: Queryable;
  resolveDistricts?: DistrictResolver;
  /** Override the HTTP fetch used by the fetch stage (tests). */
  fetchFn?: typeof fetch;
  /** Core pipeline deps (config required; sinks optional). */
  pipeline: PipelineDeps;
}

/** Wires the data.gov.in Agmarknet source into the framework pipeline. */
export function buildDataGovInPipeline(deps: DataGovInPipelineDeps): Pipeline {
  const { sourceConfig, pool } = deps;
  const resolveDistricts = deps.resolveDistricts ?? createDistrictResolver(pool);

  const stages: PipelineStages<MandiPriceRecord> = {
    fetch: createFetcher(sourceConfig, deps.fetchFn),
    parse: parseContent,
    validate: createValidator(resolveDistricts),
    normalize,
    deduplicate,
    load: createUpsertLoader<MandiPriceRecord>({
      pool,
      table: PRICES_TABLE,
      conflictColumns: [...PRICES_NATURAL_KEY],
      columns: [...PRICES_COLUMNS],
      map: (record) => {
        if (record.districtLgdCode === undefined) {
          throw new ETLError('LOAD_ERROR', 'valid record is missing districtLgdCode');
        }
        return {
          district_lgd_code: record.districtLgdCode,
          market: record.market,
          commodity: record.commodity,
          variety: record.variety,
          grade: record.grade,
          min_price: record.minPrice,
          max_price: record.maxPrice,
          modal_price: record.modalPrice,
          price_date: record.priceDate,
        };
      },
    }),
  };

  return createPipeline('data_gov_in', stages, deps.pipeline);
}

/**
 * Runs the source end-to-end against Postgres (fetch → load → audit) and
 * returns the run report. Used by the sample importer and scheduled runners.
 */
export async function runDataGovIn(
  config: Config,
  sourceConfig: DataGovInConfig,
  pool: Queryable,
): Promise<ReturnType<Pipeline['run']>> {
  const pipeline = buildDataGovInPipeline({
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
