import { Writable } from 'node:stream';
import { InMemoryMetrics } from '../src/core/metrics.js';
import { createLogger } from '../src/core/logger.js';
import type {
  AuditSink,
  Config,
  DeadLetterSink,
  Deduplicator,
  DedupOutcome,
  ETLRecord,
  Fetcher,
  Loader,
  LoadResult,
  Logger,
  Normalizer,
  Parser,
  RunReport,
  StageContext,
  StageName,
  Transformer,
  ValidationOutcome,
  Validator,
  LogLevel,
} from '../src/core/types.js';

export function testConfig(overrides: Partial<Config> = {}): Config {
  return {
    env: 'test',
    logLevel: 'error',
    retry: { attempts: 3, baseBackoffMs: 5, maxBackoffMs: 20 },
    batchSize: 2,
    deadLetterDir: 'etl/.dead-letter',
    ...overrides,
  };
}

export function testCtx(stage: StageName = 'load'): StageContext {
  return {
    source: 'test',
    stage,
    config: testConfig(),
    log: collectingLogger().logger,
    metrics: new InMemoryMetrics(),
  };
}

export function collectingLogger(level: LogLevel = 'debug'): {
  logger: Logger;
  lines: Record<string, unknown>[];
} {
  const lines: Record<string, unknown>[] = [];
  const stream = new Writable({
    write(chunk: string | Buffer, _enc, cb) {
      lines.push(JSON.parse(String(chunk)) as Record<string, unknown>);
      cb();
    },
  });
  return { logger: createLogger({ level, stream }), lines };
}

export function fakeFetcher(content: string): Fetcher {
  return async () => ({ content, meta: { fetchedAt: new Date().toISOString() } });
}

export function failingFetcher(error: unknown): Fetcher {
  return async () => {
    throw error;
  };
}

export function fakeParser<T extends ETLRecord>(records: T[]): Parser<T> {
  return async () => records;
}

/** Validates with a predicate; a record is invalid when it yields errors. */
export function fakeValidator<T extends ETLRecord>(
  errorsFor: (record: T) => string[] = () => [],
): Validator<T> {
  return async (records): Promise<ValidationOutcome<T>> => {
    const invalid = records
      .map((record) => ({ record, errors: errorsFor(record) }))
      .filter((entry) => entry.errors.length > 0);
    const invalidSet = new Set(invalid.map((entry) => entry.record));
    return { valid: records.filter((r) => !invalidSet.has(r)), invalid };
  };
}

export function identityNormalizer<T extends ETLRecord>(): Normalizer<T> {
  return async (records) => records;
}

export function dedupeByKey<T extends ETLRecord>(key: (r: T) => string): Deduplicator<T> {
  return async (records): Promise<DedupOutcome<T>> => {
    const seen = new Set<string>();
    const kept: T[] = [];
    const removed: T[] = [];
    for (const r of records) {
      const k = key(r);
      if (seen.has(k)) {
        removed.push(r);
        continue;
      }
      seen.add(k);
      kept.push(r);
    }
    return { kept, removed };
  };
}

export function fakeTransformer<T extends ETLRecord>(filter?: (r: T) => boolean): Transformer<T> {
  return async (records) => (filter ? records.filter(filter) : records);
}

export function fakeLoader<T extends ETLRecord>(
  result: Partial<LoadResult> = {},
): { loader: Loader<T>; calls: T[][] } {
  const calls: T[][] = [];
  const loader: Loader<T> = async (records) => {
    calls.push(records);
    return { upserted: records.length, inserted: records.length, updated: 0, ...result };
  };
  return { loader, calls };
}

export function failingLoader<T extends ETLRecord>(
  error: unknown,
): { loader: Loader<T>; calls: T[][] } {
  const calls: T[][] = [];
  const loader: Loader<T> = async (records) => {
    calls.push(records);
    throw error;
  };
  return { loader, calls };
}

export function memoryDeadLetter(): {
  sink: DeadLetterSink;
  items: { source: string; stage: string; reason: string; records: ETLRecord[] }[];
} {
  const items: { source: string; stage: string; reason: string; records: ETLRecord[] }[] = [];
  const sink: DeadLetterSink = {
    async write(source, stage, reason, records) {
      items.push({ source, stage, reason, records });
    },
  };
  return { sink, items };
}

export function memoryAudit(): { sink: AuditSink; runs: RunReport[] } {
  const runs: RunReport[] = [];
  const sink: AuditSink = {
    async record(run) {
      runs.push(run);
    },
  };
  return { sink, runs };
}
