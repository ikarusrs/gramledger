import { ETLError, describeError } from './errors.js';
import { InMemoryMetrics } from './metrics.js';
import { createLogger } from './logger.js';
import { withRetry } from './retry.js';
import { NullDeadLetterSink } from '../sinks/dead-letter.js';
import type {
  AuditSink,
  Config,
  DeadLetterSink,
  Deduplicator,
  ETLRecord,
  Fetcher,
  FetchResult,
  Loader,
  Logger,
  Metrics,
  Normalizer,
  Parser,
  RunError,
  RunReport,
  StageContext,
  StageName,
  Transformer,
  Validator,
} from './types.js';

/** The stages a source must provide. `deduplicate` and `transform` are optional. */
export interface PipelineStages<TRecord extends ETLRecord = ETLRecord> {
  fetch: Fetcher;
  parse: Parser<TRecord>;
  validate: Validator<TRecord>;
  normalize: Normalizer<TRecord>;
  deduplicate?: Deduplicator<TRecord>;
  transform?: Transformer<TRecord>;
  load: Loader<TRecord>;
}

export interface PipelineDeps {
  config: Config;
  log?: Logger;
  metrics?: Metrics;
  deadLetter?: DeadLetterSink;
  audit?: AuditSink;
}

export interface Pipeline {
  run(): Promise<RunReport>;
}

/**
 * Creates a pipeline for one source. `run()` executes the stages in order:
 *
 *   fetch → parse → validate → normalize → [deduplicate] → [transform] → load → report
 *
 * Behaviour:
 * - **fetch** is retried with exponential backoff (config.retry) on retryable errors.
 * - **validate** rejects are written to the dead-letter sink and counted as failed.
 * - **load** runs in batches (config.batchSize); a failed batch is dead-lettered
 *   and the run continues (status `partial`). Any other stage error aborts the
 *   run (status `failed`).
 * - Every run is summarized in a `RunReport`; if an audit sink is provided it
 *   is persisted (e.g. into `ingestion_runs`).
 */
export function createPipeline<TRecord extends ETLRecord = ETLRecord>(
  source: string,
  stages: PipelineStages<TRecord>,
  deps: PipelineDeps,
): Pipeline {
  return {
    async run(): Promise<RunReport> {
      const { config, audit } = deps;
      const logger = (deps.log ?? createLogger({ level: config.logLevel })).child({ source });
      const metrics = deps.metrics ?? new InMemoryMetrics();
      const deadLetter = deps.deadLetter ?? NullDeadLetterSink();

      const startedAt = new Date();
      const warnings: string[] = [];
      const errors: RunError[] = [];
      let retryCount = 0;
      let status: RunReport['status'] = 'success';

      const ctx = (stage: StageName): StageContext => ({
        source,
        stage,
        config,
        log: logger,
        metrics,
      });

      const runStage = async <T>(stage: StageName, fn: () => Promise<T>): Promise<T> => {
        const start = Date.now();
        try {
          return await fn();
        } finally {
          metrics.set(`stage.${stage}.duration_ms`, Date.now() - start);
        }
      };

      const counts = {
        rowsSeen: 0,
        rowsUpserted: 0,
        rowsSkipped: 0,
        rowsFailed: 0,
        duplicatesRemoved: 0,
        validationFailures: 0,
      };

      try {
        // 1. Fetch — the only retryable stage (transient network errors).
        let fetchResult: FetchResult;
        try {
          fetchResult = await withRetry(() => runStage('fetch', () => stages.fetch(ctx('fetch'))), {
            attempts: config.retry.attempts,
            baseBackoffMs: config.retry.baseBackoffMs,
            maxBackoffMs: config.retry.maxBackoffMs,
            onRetry: (error, attempt) => {
              retryCount++;
              metrics.increment('retry.count');
              logger.warn('fetch failed; retrying', { attempt, ...describeError(error) });
            },
          });
        } catch (cause) {
          const detail = describeError(cause);
          throw new ETLError('FETCH_ERROR', `fetch stage failed: ${detail.message}`, {
            source,
            stage: 'fetch',
            retryable: false,
            cause,
          });
        }
        metrics.set('fetch.bytes', Buffer.byteLength(fetchResult.content));

        // 2. Parse.
        const parsed = await runStage('parse', () => stages.parse(fetchResult, ctx('parse')));
        counts.rowsSeen = parsed.length;
        metrics.set('rows.seen', counts.rowsSeen);

        // 3. Validate — rejects are dead-lettered, not fatal.
        const validation = await runStage('validate', () =>
          stages.validate(parsed, ctx('validate')),
        );
        counts.validationFailures = validation.invalid.length;
        metrics.set('validation.failures', counts.validationFailures);
        if (validation.invalid.length > 0) {
          metrics.increment('rows.failed', validation.invalid.length);
          await deadLetter.write(
            source,
            'validate',
            'validation failed',
            validation.invalid.map((r) => r.record),
          );
          logger.warn('records dead-lettered', {
            stage: 'validate',
            count: validation.invalid.length,
            reasons: validation.invalid.slice(0, 10).map((r) => r.errors),
          });
        }

        // 4. Normalize.
        let records = await runStage('normalize', () =>
          stages.normalize(validation.valid, ctx('normalize')),
        );

        // 5. Deduplicate (optional).
        if (stages.deduplicate) {
          const dedup = await runStage('deduplicate', () =>
            stages.deduplicate!(records, ctx('deduplicate')),
          );
          counts.duplicatesRemoved = dedup.removed.length;
          metrics.set('rows.duplicates_removed', counts.duplicatesRemoved);
          metrics.increment('rows.skipped', dedup.removed.length);
          records = dedup.kept;
        }

        // 6. Transform (optional) — may filter records.
        if (stages.transform) {
          const before = records.length;
          records = await runStage('transform', () => stages.transform!(records, ctx('transform')));
          metrics.increment('rows.skipped', before - records.length);
        }

        // 7. Load — batch by batch; a failed batch is dead-lettered, the rest continue.
        const batches = chunk(records, config.batchSize);
        if (batches.length === 0) {
          logger.info('no records to load');
        } else {
          for (const batch of batches) {
            try {
              const result = await runStage('load', () => stages.load(batch, ctx('load')));
              counts.rowsUpserted += result.upserted;
              metrics.increment('rows.upserted', result.upserted);
            } catch (cause) {
              status = 'partial';
              metrics.increment('rows.failed', batch.length);
              metrics.increment('load.batch_failures');
              const detail = describeError(cause);
              errors.push({ code: detail.code, message: detail.message, stage: 'load' });
              await deadLetter.write(source, 'load', `load failed: ${detail.message}`, batch);
              logger.error('load batch failed; dead-lettered', {
                count: batch.length,
                error: detail,
              });
            }
          }
        }

        counts.rowsSkipped = metrics.get('rows.skipped');
        counts.rowsFailed = metrics.get('rows.failed');
      } catch (cause) {
        status = 'failed';
        const detail = describeError(cause);
        const stage = cause instanceof ETLError ? cause.stage : undefined;
        errors.push({ code: detail.code, message: detail.message, stage });
        logger.error('pipeline failed', detail);
      }

      const finishedAt = new Date();
      const durationMs = finishedAt.getTime() - startedAt.getTime();
      metrics.set('pipeline.duration_ms', durationMs);
      metrics.set('retry.count', retryCount);

      const report: RunReport = {
        source,
        status,
        startedAt: startedAt.toISOString(),
        finishedAt: finishedAt.toISOString(),
        durationMs,
        retryCount,
        counts,
        warnings,
        errors,
      };

      logger.info('pipeline complete', {
        status,
        duration_ms: durationMs,
        retry_count: retryCount,
        counts: report.counts,
        error_count: errors.length,
      });

      if (audit) {
        try {
          await audit.record(report);
        } catch (cause) {
          logger.error('failed to persist run report', describeError(cause));
        }
      }

      return report;
    },
  };
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}
