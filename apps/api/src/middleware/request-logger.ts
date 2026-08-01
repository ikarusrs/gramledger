import type { MiddlewareHandler } from 'hono';
import { getConfig } from '../config';
import { createLogger } from '../lib/logger';

/**
 * Structured request logging for every request.
 */
export function requestLogger(): MiddlewareHandler {
  return async (c, next) => {
    const started = Date.now();
    await next();
    const logger = createLogger(getConfig(c.env).logLevel);
    logger.info('request', {
      method: c.req.method,
      path: c.req.path,
      status: c.res.status,
      durationMs: Date.now() - started,
      requestId: c.get('requestId'),
    });
  };
}
