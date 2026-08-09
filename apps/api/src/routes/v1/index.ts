import { Hono } from 'hono';
import type { AppEnv } from '../../config';
import { hierarchyRouter } from './hierarchy';
import { panchayatRouter } from './panchayats';

/**
 * Versioned router namespace. All feature endpoints mount under `/v1` (see
 * PLANNING.md §6).
 */
export const v1Router = new Hono<AppEnv>();

v1Router.route('/', hierarchyRouter);
v1Router.route('/', panchayatRouter);
