export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_WEIGHT: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

export interface Logger {
  debug(msg: string, fields?: Record<string, unknown>): void;
  info(msg: string, fields?: Record<string, unknown>): void;
  warn(msg: string, fields?: Record<string, unknown>): void;
  error(msg: string, fields?: Record<string, unknown>): void;
}

/**
 * Minimal structured logger. Emits JSON lines so `wrangler logpush` and other
 * tooling can index them. A pino-style library can replace this if we ever
 * outgrow it — keep it dependency-free for now.
 */
export function createLogger(minLevel: LogLevel): Logger {
  const threshold = LEVEL_WEIGHT[minLevel];

  function log(level: LogLevel, msg: string, fields?: Record<string, unknown>): void {
    if (LEVEL_WEIGHT[level] < threshold) return;
    const line = JSON.stringify({
      time: new Date().toISOString(),
      level,
      msg,
      ...fields,
    });
    const out = level === 'error' ? console.error : console.log;
    out(line);
  }

  return {
    debug: (msg, fields) => log('debug', msg, fields),
    info: (msg, fields) => log('info', msg, fields),
    warn: (msg, fields) => log('warn', msg, fields),
    error: (msg, fields) => log('error', msg, fields),
  };
}
