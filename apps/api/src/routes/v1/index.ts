import { Hono } from 'hono';
import type { AppEnv } from '../../config';
import { financeRouter } from './finance';
import { hierarchyRouter } from './hierarchy';
import { panchayatsRouter } from './panchayats';

/**
 * Versioned router namespace.
 *
 * All feature endpoints mount under `/v1` (see PLANNING.md §6). Read endpoints
 * currently serve demo data (`src/data/demo.ts`); the Postgres-backed
 * repository replaces the data layer while keeping this contract stable.
 */
export const v1Router = new Hono<AppEnv>();

v1Router.route('/hierarchy', hierarchyRouter);
v1Router.route('/panchayats', panchayatsRouter);
v1Router.route('/panchayats/:id/finance', financeRouter);
