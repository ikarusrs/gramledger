import { Hono } from 'hono';
import type { AppEnv } from '../../config';
import { hierarchyRouter } from './hierarchy';
import { panchayatRouter } from './panchayats';
import { financeRouter } from './finance';
import { detailRouter } from './profile';
import { advisorRouter } from './advisor';
import { videosRouter } from './videos';
import { authRouter } from './auth';

/**
 * Versioned router namespace. All feature endpoints mount under `/v1` (see
 * PLANNING.md §6).
 */
export const v1Router = new Hono<AppEnv>();

v1Router.route('/', hierarchyRouter);
v1Router.route('/', panchayatRouter);
v1Router.route('/', financeRouter);
v1Router.route('/', detailRouter);
v1Router.route('/', advisorRouter);
v1Router.route('/', videosRouter);
v1Router.route('/', authRouter);
