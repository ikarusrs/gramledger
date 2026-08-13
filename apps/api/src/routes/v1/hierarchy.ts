import { Hono } from 'hono';
import type { AppEnv } from '../../config';
import { getHierarchy } from '../../data/demo';

export const hierarchyRouter = new Hono<AppEnv>();

hierarchyRouter.get('/', (c) => c.json(getHierarchy()));
