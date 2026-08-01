import { Hono } from 'hono';
import type { AppEnv } from '../../config';

/**
 * Versioned router namespace.
 *
 * All feature endpoints mount under `/v1` (see PLANNING.md §6). No endpoints
 * are registered yet — this exists to fix the API versioning contract in place
 * so feature branches add routes without restructuring.
 */
export const v1Router = new Hono<AppEnv>();
