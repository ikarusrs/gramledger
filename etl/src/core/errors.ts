import type { StageName } from './types.js';

/**
 * Structured ETL errors. Every error carries a stable `code` and serializes
 * losslessly (for logs, metrics, and the dead-letter path). `retryable` marks
 * transient failures (e.g. network) that the fetch retry loop should retry.
 */
export type ErrorCode =
  | 'CONFIG_ERROR'
  | 'FETCH_ERROR'
  | 'PARSE_ERROR'
  | 'VALIDATION_ERROR'
  | 'LOAD_ERROR'
  | 'PIPELINE_ERROR';

export interface ETLErrorOptions {
  source?: string;
  stage?: StageName;
  /** True when a retry may succeed (transient failures). */
  retryable?: boolean;
  cause?: unknown;
  details?: Record<string, unknown>;
}

export class ETLError extends Error {
  readonly code: ErrorCode;
  readonly source?: string;
  readonly stage?: StageName;
  readonly retryable: boolean;
  readonly details: Record<string, unknown>;
  readonly cause?: unknown;

  constructor(code: ErrorCode, message: string, options: ETLErrorOptions = {}) {
    super(message);
    this.name = 'ETLError';
    this.code = code;
    this.source = options.source;
    this.stage = options.stage;
    this.retryable = options.retryable ?? false;
    this.details = options.details ?? {};
    this.cause = options.cause;
  }

  toJSON(): {
    error: {
      code: ErrorCode;
      message: string;
      source?: string;
      stage?: StageName;
      details: Record<string, unknown>;
    };
    retryable: boolean;
  } {
    return {
      error: {
        code: this.code,
        message: this.message,
        source: this.source,
        stage: this.stage,
        details: this.details,
      },
      retryable: this.retryable,
    };
  }
}

/** True when the error is a retryable ETL error. */
export function isRetryable(error: unknown): boolean {
  return error instanceof ETLError && error.retryable;
}

/** Stable, serializable description of any thrown value. */
export function describeError(error: unknown): {
  code: string;
  message: string;
  retryable?: boolean;
  details?: Record<string, unknown>;
} {
  if (error instanceof ETLError) {
    return {
      code: error.code,
      message: error.message,
      retryable: error.retryable,
      details: error.details,
    };
  }
  if (error instanceof Error) {
    return { code: 'UNKNOWN', message: error.message };
  }
  return { code: 'UNKNOWN', message: String(error) };
}
