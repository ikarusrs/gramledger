import {
  createPipeline,
  type Pipeline,
  type PipelineDeps,
  type PipelineStages,
} from '../../src/core/pipeline.js';
import type { Config } from '../../src/core/types.js';
import { createPostgresAuditSink, type Queryable } from '../../src/sinks/postgres.js';
import { FileDeadLetterSink } from '../../src/sinks/dead-letter.js';
import { createFetcher } from './client.js';
import { createValidator } from './validate.js';
import { deduplicate, normalize, parseContent } from './mapping.js';
import { createHierarchyLoader } from './loader.js';
import type { LgdConfig, LgdRow } from './types.js';

export interface LgdPipelineDeps {
  sourceConfig: LgdConfig;
  pool: Queryable;
  /** Override the HTTP fetch used by the fetch stage (tests). */
  fetchFn?: typeof fetch;
  /** Core pipeline deps (config required; sinks optional). */
  pipeline: PipelineDeps;
}

/**
 * Wires the LGD source into the framework pipeline. One run fetches the
 * village→Gram Panchayat mapping and populates the five hierarchy tables in FK
 * order (states → districts → talukas → panchayats → villages), idempotent on
 * `lgd_code`.
 */
export function buildLgdPipeline(deps: LgdPipelineDeps): Pipeline {
  const { sourceConfig, pool } = deps;

  const stages: PipelineStages<LgdRow> = {
    fetch: createFetcher(sourceConfig, deps.fetchFn),
    parse: parseContent,
    validate: createValidator(),
    normalize,
    deduplicate,
    load: createHierarchyLoader(pool),
  };

  return createPipeline('lgd', stages, deps.pipeline);
}

/**
 * Runs the source end-to-end against Postgres (fetch → load → audit) and
 * returns the run report. Used by the scheduled runner (GitHub Actions cron).
 */
export async function runLgd(
  config: Config,
  sourceConfig: LgdConfig,
  pool: Queryable,
): Promise<ReturnType<Pipeline['run']>> {
  const pipeline = buildLgdPipeline({
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
