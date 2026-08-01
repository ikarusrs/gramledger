import {
  createPipeline,
  type Pipeline,
  type PipelineDeps,
  type PipelineStages,
} from '../../src/core/pipeline.js';
import type { Loader } from '../../src/core/types.js';
import { createEGramSwarajFetcher, type FetchOptions } from './client.js';
import { loadEGramSwarajConfig } from './config.js';
import { deduplicate, normalize, transform, validate } from './stages.js';
import { parseContent } from './parser.js';
import type { EGramRecord, EGramSwarajConfig } from './types.js';

export interface EGramPipelineDeps {
  sourceConfig: EGramSwarajConfig;
  pipeline: PipelineDeps;
  /** Database loader is intentionally injected until panchayat-level export is approved. */
  loader: Loader<EGramRecord>;
  fetch?: FetchOptions;
}

export function buildEGramSwarajPipeline(deps: EGramPipelineDeps): Pipeline {
  const stages: PipelineStages<EGramRecord> = {
    fetch: createEGramSwarajFetcher(deps.sourceConfig, deps.fetch),
    parse: parseContent,
    validate,
    normalize,
    deduplicate,
    transform,
    load: deps.loader,
  };
  return createPipeline('egramswaraj', stages, deps.pipeline);
}

export { loadEGramSwarajConfig };
export * from './types.js';
export * from './html.js';
export * from './parser.js';
export * from './stages.js';
