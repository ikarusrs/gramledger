import { ETLError } from './errors.js';
import type { Config, Env, LogLevel } from './types.js';

/** Anything that behaves like `process.env`. */
export type EnvLike = Record<string, string | undefined>;

const LOG_LEVELS: readonly LogLevel[] = ['debug', 'info', 'warn', 'error'];
const ENVS: readonly Env[] = ['development', 'test', 'production'];

/**
 * Loads and validates ETL configuration from environment variables. Every
 * variable has a sane default; numeric values must be positive integers.
 *
 * | Variable                      | Default       |
 * | ----------------------------- | ------------- |
 * | `ETL_ENV`                     | development   |
 * | `ETL_LOG_LEVEL`               | info (error in test) |
 * | `ETL_RETRY_ATTEMPTS`          | 3             |
 * | `ETL_RETRY_BASE_BACKOFF_MS`   | 1000          |
 * | `ETL_RETRY_MAX_BACKOFF_MS`    | 30000         |
 * | `ETL_BATCH_SIZE`              | 1000          |
 * | `ETL_DEAD_LETTER_DIR`         | etl/.dead-letter |
 * | `DATABASE_URL`                | (optional)    |
 */
export function loadConfig(env: EnvLike = process.env): Config {
  const envName = env.ETL_ENV ?? 'development';
  if (!ENVS.includes(envName as Env)) {
    throw new ETLError('CONFIG_ERROR', 'ETL_ENV must be development, test, or production', {
      details: { value: envName },
    });
  }

  const defaultLevel: LogLevel = envName === 'test' ? 'error' : 'info';
  const logLevel = env.ETL_LOG_LEVEL ?? defaultLevel;
  if (!LOG_LEVELS.includes(logLevel as LogLevel)) {
    throw new ETLError('CONFIG_ERROR', 'ETL_LOG_LEVEL must be debug, info, warn, or error', {
      details: { value: logLevel },
    });
  }

  return {
    env: envName as Env,
    logLevel: logLevel as LogLevel,
    retry: {
      attempts: positiveInt('ETL_RETRY_ATTEMPTS', 3, env),
      baseBackoffMs: positiveInt('ETL_RETRY_BASE_BACKOFF_MS', 1000, env),
      maxBackoffMs: positiveInt('ETL_RETRY_MAX_BACKOFF_MS', 30000, env),
    },
    batchSize: positiveInt('ETL_BATCH_SIZE', 1000, env),
    deadLetterDir: env.ETL_DEAD_LETTER_DIR ?? 'etl/.dead-letter',
    databaseUrl: env.DATABASE_URL,
  };
}

function positiveInt(name: string, fallback: number, env: EnvLike): number {
  const raw = env[name];
  if (raw === undefined || raw === '') return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) {
    throw new ETLError('CONFIG_ERROR', `ETL config '${name}' must be a positive integer`, {
      details: { name, value: raw },
    });
  }
  return value;
}
