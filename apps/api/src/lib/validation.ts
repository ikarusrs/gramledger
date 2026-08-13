import { zValidator } from '@hono/zod-validator';
import type { ValidationTargets } from 'hono';
import type { ZodType } from 'zod';

/**
 * `zValidator` variant that maps validation failures to the standard error
 * envelope (`{ error: { code, message, details } }`, see AGENTS.md). The base
 * `zValidator` returns `{ success: false, error }` directly, bypassing the
 * central error handler — this restores the envelope contract.
 */
export function zValidatorEnveloped<Target extends keyof ValidationTargets, S extends ZodType>(
  target: Target,
  schema: S,
) {
  return zValidator(target, schema, (result, c) => {
    if (!result.success) {
      return c.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request',
            details: result.error.issues,
          },
        },
        400,
      );
    }
  });
}
