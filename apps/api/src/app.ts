import { Hono } from 'hono';
import type { AppEnv } from './config';
import { healthRouter } from './routes/health';
import { v1Router } from './routes/v1';
import { requestId } from './middleware/request-id';
import { requestLogger } from './middleware/request-logger';
import { errorHandler } from './middleware/error-handler';
import { notFound } from './lib/errors';
import { dbLayer } from './middleware/db';
import type { Db } from './lib/db';

/**
 * Composes the application. Kept separate from the worker entry (`index.ts`)
 * so tests can build an app instance and drive it with `app.request(...)`.
 * Pass a fake `db` in tests; production resolves it from bindings.
 */
export function buildApp(options: { db?: Db } = {}): Hono<AppEnv> {
  const app = new Hono<AppEnv>();

  app.use('*', requestId());
  app.use('*', requestLogger());
  app.use('*', dbLayer(options.db));
  app.onError(errorHandler);

  app.notFound((c) => c.json({ error: { code: 'NOT_FOUND', message: notFound().message } }, 404));

  app.route('/', healthRouter);
  app.route('/v1', v1Router);

  return app;
}
