import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import type { AppEnv } from '../../config';
import type { Db } from '../../lib/db';
import { requireAuth } from '../../middleware/auth';
import { serviceUnavailable } from '../../lib/errors';

const idSchema = z.object({ panchayatId: z.coerce.number().int().positive() });
export const favoritesRouter = new Hono<AppEnv>();
favoritesRouter.use('/me/favorites', requireAuth);
favoritesRouter.use('/me/favorites/*', requireAuth);

favoritesRouter.get('/me/favorites', async (c) => {
  const db = c.get('db') as Db;
  const rows = await db.query(
    'SELECT panchayat_id AS "panchayatId", created_at AS "createdAt" FROM favorites WHERE user_id = $1 ORDER BY created_at DESC',
    [c.get('userId')],
  );
  return c.json(rows);
});

favoritesRouter.post('/me/favorites', zValidator('json', idSchema), async (c) => {
  const db = c.get('db') as Db;
  const { panchayatId } = c.req.valid('json');
  await db.query(
    'INSERT INTO favorites (user_id, panchayat_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
    [c.get('userId'), panchayatId],
  );
  return c.json({ ok: true });
});

favoritesRouter.delete('/me/favorites/:panchayatId', async (c) => {
  const db = c.get('db') as Db;
  const parsed = idSchema.safeParse(c.req.param());
  if (!parsed.success) throw serviceUnavailable('Invalid panchayat id');
  await db.query('DELETE FROM favorites WHERE user_id = $1 AND panchayat_id = $2', [
    c.get('userId'),
    parsed.data.panchayatId,
  ]);
  return c.body(null, 204);
});
