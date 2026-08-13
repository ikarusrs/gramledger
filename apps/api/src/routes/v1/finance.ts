import { Hono } from 'hono';
import { z } from 'zod';

import type { AppEnv } from '../../config';
import { getFinance, hasPanchayat } from '../../data/demo';
import { notFound } from '../../lib/errors';
import { zValidatorEnveloped } from '../../lib/validation';

const querySchema = z.object({
  fy: z.coerce.number().int().min(2000).max(2100).optional(),
});

export const financeRouter = new Hono<AppEnv>();

financeRouter.get('/', zValidatorEnveloped('query', querySchema), (c) => {
  const id = Number(c.req.param('id'));
  const { fy } = c.req.valid('query');
  if (!hasPanchayat(id)) throw notFound(`Panchayat ${id} not found`);
  return c.json(getFinance(id, fy ?? 2024));
});
