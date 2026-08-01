import type { MiddlewareHandler } from 'hono';
import { createRequestId } from '../lib/request-id';

/**
 * Assigns a short opaque request id to every request so logs and errors can be
 * correlated across middleware and error handlers.
 */
export function requestId(): MiddlewareHandler {
  return async (c, next) => {
    c.set('requestId', createRequestId());
    await next();
  };
}
