import { Hono } from 'hono';
import type { AppEnv } from '../config';
import { APP_NAME } from '../config';

/**
 * Unversioned liveness endpoint for load balancers / uptime checks.
 */
export const healthRouter = new Hono<AppEnv>();

healthRouter.get('/health', (c) =>
  c.json({
    status: 'ok',
    service: APP_NAME,
    timestamp: new Date().toISOString(),
  }),
);
