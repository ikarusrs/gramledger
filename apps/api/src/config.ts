/**
 * Worker bindings (flat): non-secret config arrives via `[vars]` in
 * `wrangler.toml`; secrets via `wrangler secret put` / `.dev.vars`.
 */
export type Bindings = {
  ENVIRONMENT?: string;
  LOG_LEVEL?: string;
  GROQ_API_KEY?: string;
  GROQ_MODEL?: string;
  YOUTUBE_API_KEY?: string;
  RESEND_API_KEY?: string;
  AUTH_FROM_EMAIL?: string;
  JWT_SECRET?: string;
  [key: string]: unknown;
};

/**
 * Request-scoped variables set by middleware (see `middleware/request-id.ts`).
 */
export type Variables = {
  requestId?: string;
  [key: string]: unknown;
};

/**
 * Hono's env shape. `Hono<AppEnv>` gives handlers typed access to `c.env`
 * (the bindings) and `c.get/set` (the variables).
 */
export type AppEnv = {
  Bindings: Bindings;
  Variables: Variables;
};

export const APP_NAME = 'gramledger-api';
export const DEFAULT_API_VERSION = 'v1';

export interface AppConfig {
  environment: string;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  apiVersion: string;
}

const LOG_LEVELS = new Set(['debug', 'info', 'warn', 'error']);

export function getConfig(bindings: Bindings): AppConfig {
  const logLevel = bindings.LOG_LEVEL ?? 'info';
  return {
    environment: bindings.ENVIRONMENT ?? 'development',
    logLevel: LOG_LEVELS.has(logLevel) ? (logLevel as AppConfig['logLevel']) : 'info',
    apiVersion: DEFAULT_API_VERSION,
  };
}
