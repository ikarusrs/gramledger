import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import type { AppEnv } from '../../config';
import type { Db, Row } from '../../lib/db';
import { serviceUnavailable } from '../../lib/errors';

/** Response shape mirrors `apps/web/src/lib/api/types.ts#Panchayat`. */
export interface Panchayat {
  id: number;
  lgdCode: string;
  nameMr: string;
  nameEn: string;
  districtId: number;
  districtNameMr?: string;
  districtNameEn?: string;
  talukaId: number;
  talukaNameMr?: string;
  talukaNameEn?: string;
  level: 'gram' | 'block' | 'district';
}

interface PanchayatRow extends Row {
  id: string;
  lgd_code: string;
  name_mr: string;
  name_en: string;
  district_id: string;
  district_name_mr: string;
  district_name_en: string;
  taluka_id: string;
  taluka_name_mr: string;
  taluka_name_en: string;
  level: 'gram' | 'block' | 'district';
}

const searchSchema = z.object({
  q: z.string().trim().max(100).optional(),
  districtId: z.coerce.number().int().positive().optional(),
  talukaId: z.coerce.number().int().positive().optional(),
});

export const panchayatRouter = new Hono<AppEnv>();

panchayatRouter.get('/panchayats', zValidator('query', searchSchema), async (c) => {
  const db = c.get('db') as Db | undefined;
  if (!db) throw serviceUnavailable();

  const { q, districtId, talukaId } = c.req.valid('query');

  const conditions: string[] = [];
  const params: unknown[] = [];
  if (q) {
    params.push(`%${q}%`);
    conditions.push(`(p.name_en ILIKE $${params.length} OR p.name_mr ILIKE $${params.length})`);
  }
  if (districtId !== undefined) {
    params.push(districtId);
    conditions.push(`p.district_id = $${params.length}`);
  }
  if (talukaId !== undefined) {
    params.push(talukaId);
    conditions.push(`p.taluka_id = $${params.length}`);
  }
  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const sql = `
    SELECT
      p.id, p.lgd_code, p.name_mr, p.name_en, p.level,
      d.id AS district_id, d.name_mr AS district_name_mr, d.name_en AS district_name_en,
      t.id AS taluka_id, t.name_mr AS taluka_name_mr, t.name_en AS taluka_name_en
    FROM panchayats p
    JOIN districts d ON d.id = p.district_id
    JOIN talukas t ON t.id = p.taluka_id
    ${where}
    ORDER BY p.name_en
    LIMIT 50
  `;

  const rows = (await db.query(sql, params)) as PanchayatRow[];
  const panchayats: Panchayat[] = rows.map((row) => ({
    id: Number(row.id),
    lgdCode: String(row.lgd_code),
    nameMr: row.name_mr,
    nameEn: row.name_en,
    districtId: Number(row.district_id),
    districtNameMr: row.district_name_mr,
    districtNameEn: row.district_name_en,
    talukaId: Number(row.taluka_id),
    talukaNameMr: row.taluka_name_mr,
    talukaNameEn: row.taluka_name_en,
    level: row.level,
  }));

  return c.json(panchayats);
});
