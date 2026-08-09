/**
 * GramLedger ETL framework — public API.
 *
 * Sources implement the stage functions from `core/types.ts` (or reuse the
 * helpers here) and wire them with `createPipeline`. Sinks cover the common
 * Postgres + dead-letter needs. See `sources/example/` and `README.md`.
 */

// Core
export * from './core/types.js';
export { ETLError, describeError, isRetryable } from './core/errors.js';
export { createLogger } from './core/logger.js';
export { InMemoryMetrics } from './core/metrics.js';
export { loadConfig } from './core/config.js';
export { withRetry, sleep } from './core/retry.js';
export { createPipeline } from './core/pipeline.js';
export type { Pipeline, PipelineDeps, PipelineStages } from './core/pipeline.js';

// Sinks
export { createPool, createPostgresAuditSink, createUpsertLoader } from './sinks/postgres.js';
export type { PostgresAuditSinkOptions, UpsertLoaderOptions } from './sinks/postgres.js';
export { FileDeadLetterSink, NullDeadLetterSink } from './sinks/dead-letter.js';
export type { FileDeadLetterSinkOptions } from './sinks/dead-letter.js';
export { createSnapshotSink, FileObjectStore } from './sinks/snapshot.js';
export type { ObjectStore, SnapshotSink, SnapshotSinkOptions } from './sinks/snapshot.js';
