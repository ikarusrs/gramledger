import type { MiddlewareHandler } from 'hono';
import { createDb, type Db } from '../lib/db';

/**
 * Injects the database client into the request context (`c.get('db')`). Routes
 * that need a database call `serviceUnavailable` when none is configured.
 */
export function dbLayer(db?: Db): MiddlewareHandler {
  return async (c, next) => {
    c.set('db', db ?? createDb(c.env));
    await next();
  };
}
