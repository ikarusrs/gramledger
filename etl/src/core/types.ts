/**
 * Shared ETL contracts: the record shapes, stage function types, and the
 * context handed to every stage. Sources implement the stage functions; the
 * pipeline orchestrates them. Keep this file dependency-free so any module can
 * import from it without cycles.
 */

/** A generic record flowing between stages. Sources may narrow this. */
export type ETLRecord = Record<string, unknown>;

/** Pipeline stages, in execution order. */
export type StageName =
  'fetch' | 'parse' | 'validate' | 'normalize' | 'deduplicate' | 'transform' | 'load';

/** Log levels, most verbose first. */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/** Runtime environment. */
export type Env = 'development' | 'test' | 'production';

/** Resolved ETL configuration (see `core/config.ts` for loading). */
export interface Config {
  env: Env;
  logLevel: LogLevel;
  retry: {
    /** Total attempts for a retryable operation. */
    attempts: number;
    /** Initial backoff in ms; doubles per attempt. */
    baseBackoffMs: number;
    /** Upper bound on backoff in ms. */
    maxBackoffMs: number;
  };
  /** Records per load batch; each batch is loaded in one call. */
  batchSize: number;
  /** Directory for dead-lettered records. */
  deadLetterDir: string;
  /** Optional Postgres connection string for the DB sinks. */
  databaseUrl?: string;
}

/** Structured logger (JSON lines). See `core/logger.ts`. */
export interface Logger {
  debug(msg: string, fields?: Record<string, unknown>): void;
  info(msg: string, fields?: Record<string, unknown>): void;
  warn(msg: string, fields?: Record<string, unknown>): void;
  error(msg: string, fields?: Record<string, unknown>): void;
  /** Returns a logger with additional fields merged into every record. */
  child(fields: Record<string, unknown>): Logger;
}

/** In-run metrics collector. See `core/metrics.ts`. */
export interface Metrics {
  increment(name: string, by?: number): void;
  set(name: string, value: number): void;
  get(name: string): number;
  snapshot(): Record<string, number>;
}

/** Context passed to every stage: source identity + config + logging + metrics. */
export interface StageContext {
  source: string;
  stage: StageName;
  config: Config;
  log: Logger;
  metrics: Metrics;
}

/** Metadata attached to a fetch result. */
export interface FetchMeta {
  url?: string;
  contentType?: string;
  /** ISO timestamp of the fetch. */
  fetchedAt: string;
  [key: string]: unknown;
}

/** Output of the fetch stage. */
export interface FetchResult {
  content: string;
  meta: FetchMeta;
}

/** A record that failed validation. */
export interface InvalidRecord<TRecord extends ETLRecord = ETLRecord> {
  record: TRecord;
  errors: string[];
}

/** Result of the validate stage: records split by validity. */
export interface ValidationOutcome<TRecord extends ETLRecord = ETLRecord> {
  valid: TRecord[];
  invalid: InvalidRecord<TRecord>[];
}

/** Result of the deduplicate stage. */
export interface DedupOutcome<TRecord extends ETLRecord = ETLRecord> {
  kept: TRecord[];
  removed: TRecord[];
}

/** Result of one load call (one batch). */
export interface LoadResult {
  upserted: number;
  inserted?: number;
  updated?: number;
}

/** A structured error attached to a run report. */
export interface RunError {
  code: string;
  message: string;
  stage?: StageName;
}

/** Structured summary of a completed pipeline run. */
export interface RunReport {
  source: string;
  status: 'success' | 'partial' | 'failed';
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  retryCount: number;
  counts: {
    rowsSeen: number;
    rowsUpserted: number;
    rowsSkipped: number;
    rowsFailed: number;
    duplicatesRemoved: number;
    validationFailures: number;
  };
  warnings: string[];
  errors: RunError[];
}

/** Records rejected by a stage; persisted somewhere durable. */
export interface DeadLetterSink {
  write(source: string, stage: StageName, reason: string, records: ETLRecord[]): Promise<void>;
}

/** Persists a run report (e.g. into `ingestion_runs`). */
export interface AuditSink {
  record(run: RunReport): Promise<void>;
}

// ---------------------------------------------------------------------------
// Stage function types. Each source implements the ones it needs; the
// pipeline provides defaults for the optional stages (deduplicate, transform).
// ---------------------------------------------------------------------------

export type Fetcher = (ctx: StageContext) => Promise<FetchResult>;

export type Parser<TRecord extends ETLRecord = ETLRecord> = (
  input: FetchResult,
  ctx: StageContext,
) => Promise<TRecord[]>;

export type Validator<TRecord extends ETLRecord = ETLRecord> = (
  records: TRecord[],
  ctx: StageContext,
) => Promise<ValidationOutcome<TRecord>>;

export type Normalizer<TRecord extends ETLRecord = ETLRecord> = (
  records: TRecord[],
  ctx: StageContext,
) => Promise<TRecord[]>;

export type Deduplicator<TRecord extends ETLRecord = ETLRecord> = (
  records: TRecord[],
  ctx: StageContext,
) => Promise<DedupOutcome<TRecord>>;

export type Transformer<TRecord extends ETLRecord = ETLRecord> = (
  records: TRecord[],
  ctx: StageContext,
) => Promise<TRecord[]>;

export type Loader<TRecord extends ETLRecord = ETLRecord> = (
  records: TRecord[],
  ctx: StageContext,
) => Promise<LoadResult>;
