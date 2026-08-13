import { Hono } from 'hono';
import { z } from 'zod';

import type { AppEnv } from '../../config';
import { getPanchayat, searchPanchayats } from '../../data/demo';
import { notFound } from '../../lib/errors';
import { zValidatorEnveloped } from '../../lib/validation';

const searchSchema = z.object({
  q: z.string().trim().max(200).optional(),
  district: z.coerce.number().int().positive().optional(),
  taluka: z.coerce.number().int().positive().optional(),
});

const idParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const panchayatsRouter = new Hono<AppEnv>();

panchayatsRouter.get('/', zValidatorEnveloped('query', searchSchema), (c) => {
  const { q, district, taluka } = c.req.valid('query');
  return c.json(searchPanchayats({ q, districtId: district, talukaId: taluka }));
});

panchayatsRouter.get('/:id', zValidatorEnveloped('param', idParamSchema), (c) => {
  const { id } = c.req.valid('param');
  const panchayat = getPanchayat(id);
  if (!panchayat) throw notFound(`Panchayat ${id} not found`);
  return c.json(panchayat);
});
