/**
 * Example source: a complete (fake) pipeline wired from the framework pieces.
 *
 * This is NOT a real data source — it is the reference for writing one. A real
 * source implements its own `fetch` and `parse`, reuses the framework's
 * pipeline, sinks, and retry logic, and typically supplies its own loader via
 * `createUpsertLoader` from `sinks/postgres.ts`.
 */
import { createPipeline } from '../../src/core/pipeline.js';
import type {
  Config,
  DedupOutcome,
  ETLRecord,
  FetchResult,
  LoadResult,
  ValidationOutcome,
} from '../../src/core/types.js';
import { ETLError } from '../../src/core/errors.js';

interface MarketRecord extends ETLRecord {
  market: string;
  commodity: string;
  price: number;
}

// ---- source-specific stages -------------------------------------------------

const fetch = async (): Promise<FetchResult> => {
  // Real sources throw an ETLError({ retryable: true }) here on transient
  // network failures; the pipeline retries them with exponential backoff.
  return {
    content: 'Pune,Onion,1500\nPune,Onion,1500\nSatara,Potato,900\n',
    meta: { url: 'https://example.in/demo.csv', fetchedAt: new Date().toISOString() },
  };
};

const parse = async (input: FetchResult): Promise<MarketRecord[]> => {
  return input.content
    .trim()
    .split('\n')
    .map((line) => {
      const [market = '', commodity = '', price = ''] = line.split(',');
      return { market, commodity, price: Number(price) };
    });
};

const validate = async (records: MarketRecord[]): Promise<ValidationOutcome<MarketRecord>> => {
  const invalid = records
    .filter((r) => !Number.isFinite(r.price) || r.price <= 0)
    .map((record) => ({ record, errors: ['price must be a positive number'] }));
  const invalidKeys = new Set(invalid.map((r) => r.record));
  return { valid: records.filter((r) => !invalidKeys.has(r)), invalid };
};

const normalize = async (records: MarketRecord[]): Promise<MarketRecord[]> => records;

const deduplicate = async (records: MarketRecord[]): Promise<DedupOutcome<MarketRecord>> => {
  const seen = new Set<string>();
  const kept: MarketRecord[] = [];
  const removed: MarketRecord[] = [];
  for (const record of records) {
    const key = `${record.market}:${record.commodity}`;
    if (seen.has(key)) {
      removed.push(record);
      continue;
    }
    seen.add(key);
    kept.push(record);
  }
  return { kept, removed };
};

// An in-memory loader for the demo. Real sources use `createUpsertLoader`.
const fakeLoad = async (records: MarketRecord[]): Promise<LoadResult> => {
  loadLog.push(records);
  return { upserted: records.length, inserted: records.length, updated: 0 };
};
const loadLog: MarketRecord[][] = [];

// ---- wiring -----------------------------------------------------------------

export function buildExamplePipeline(config: Config) {
  return createPipeline<MarketRecord>(
    'example',
    { fetch, parse, validate, normalize, deduplicate, load: fakeLoad },
    { config },
  );
}

export function exampleLoadLog(): MarketRecord[][] {
  return loadLog;
}

/** Demonstrates a run; returns the pipeline for inspection. */
export async function runExample(config: Config): Promise<unknown> {
  const pipeline = buildExamplePipeline(config);
  const report = await pipeline.run();
  if (report.status === 'failed') {
    throw new ETLError('PIPELINE_ERROR', 'example run failed', { details: { report } });
  }
  return { report, batches: loadLog };
}
