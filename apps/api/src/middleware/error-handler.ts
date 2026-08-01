import type { ErrorHandler } from 'hono';
import { HTTPException } from 'hono/http-exception';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { getConfig } from '../config';
import { createLogger } from '../lib/logger';
import { AppError } from '../lib/errors';

/**
 * Central error handling. Normalizes AppError, Hono HTTPException, validation
 * (Zod) errors, and unexpected failures into a single JSON error envelope.
 */
export const errorHandler: ErrorHandler = (err, c) => {
  const logger = createLogger(getConfig(c.env).logLevel);
  const requestId = c.get('requestId');

  if (err instanceof AppError) {
    return c.json(
      {
        error: {
          code: err.code,
          message: err.message,
          ...(err.details !== undefined ? { details: err.details } : {}),
        },
      },
      err.status as ContentfulStatusCode,
    );
  }

  if (err instanceof HTTPException) {
    return c.json(
      { error: { code: 'HTTP_ERROR', message: err.message || 'HTTP error' } },
      err.status,
    );
  }

  if (err instanceof Error && err.name === 'ZodError') {
    const details = (err as { issues?: unknown[] }).issues;
    return c.json(
      { error: { code: 'VALIDATION_ERROR', message: 'Invalid request', details } },
      400,
    );
  }

  logger.error('unhandled_error', {
    requestId,
    error: err instanceof Error ? err.message : String(err),
  });
  return c.json({ error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } }, 500);
};
