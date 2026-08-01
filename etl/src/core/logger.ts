import type { Logger, LogLevel } from './types.js';

const LEVEL_ORDER: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

const SENSITIVE_KEY = /password|passwd|secret|token|api[_-]?key|authorization/i;
const URL_KEY = /url|dsn|connection|host/i;

/** Scrubs credentials from a value before it is logged. */
function sanitize(key: string, value: unknown): unknown {
  if (typeof value !== 'string') return value;
  if (SENSITIVE_KEY.test(key)) return '[REDACTED]';
  if (URL_KEY.test(key) && value.includes('://') && value.includes('@')) {
    try {
      const url = new URL(value);
      if (url.username) {
        url.username = '';
        url.password = '';
        return url.toString();
      }
    } catch {
      // Not a parseable URL; leave as-is.
    }
  }
  return value;
}

export interface LoggerOptions {
  level?: LogLevel;
  stream?: NodeJS.WritableStream;
  /** Static fields merged into every record (e.g. runId, source). */
  baseFields?: Record<string, unknown>;
}

/**
 * Structured JSON-line logger. One JSON object per line:
 * `{ ts, level, msg, ...baseFields, ...fields }`. Emits to `process.stdout`
 * unless a stream is given. Values under credential-looking keys, and
 * credentials embedded in URL fields, are redacted.
 */
export function createLogger(options: LoggerOptions = {}): Logger {
  const level = options.level ?? 'info';
  const stream = options.stream ?? process.stdout;
  const base = options.baseFields ?? {};
  const threshold = LEVEL_ORDER[level];

  const write = (lvl: LogLevel, msg: string, fields?: Record<string, unknown>): void => {
    if (LEVEL_ORDER[lvl] < threshold) return;
    const record: Record<string, unknown> = {
      ts: new Date().toISOString(),
      level: lvl,
      msg,
      ...base,
      ...fields,
    };
    for (const [key, value] of Object.entries(record)) {
      record[key] = sanitize(key, value);
    }
    stream.write(`${JSON.stringify(record)}\n`);
  };

  const child = (fields: Record<string, unknown>): Logger =>
    createLogger({ level, stream, baseFields: { ...base, ...fields } });

  return {
    debug: (msg, fields) => write('debug', msg, fields),
    info: (msg, fields) => write('info', msg, fields),
    warn: (msg, fields) => write('warn', msg, fields),
    error: (msg, fields) => write('error', msg, fields),
    child,
  };
}
