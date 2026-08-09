import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import type { AppEnv } from '../../config';
import type { Db, Row } from '../../lib/db';
import { serviceUnavailable, notFound } from '../../lib/errors';
import type { Panchayat } from './panchayats';

/** Response shapes mirror `apps/web/src/lib/api/types.ts#PanchayatDetail`. */

export interface ElectedMember {
  role: string;
  name: string;
}

export interface PanchayatProfile {
  sarpanchName: string | null;
  secretaryName: string | null;
  contactPhone: string | null;
  electedCommittee: ElectedMember[] | null;
  updatedAt: string | null;
}

export interface PanchayatDetail extends Panchayat {
  profile: PanchayatProfile;
}

interface PanchayatDetailRow extends Row {
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
  sarpanch_name: string | null;
  secretary_name: string | null;
  contact_phone: string | null;
  elected_committee: unknown;
  updated_at: string | null;
}

const detailParams = z.object({
  id: z.coerce.number().int().positive(),
});

export const detailRouter = new Hono<AppEnv>();

detailRouter.get('/panchayats/:id', zValidator('param', detailParams), async (c) => {
  const db = c.get('db') as Db | undefined;
  if (!db) throw serviceUnavailable();

  const { id } = c.req.valid('param');
  const rows = (await db.query(
    `SELECT
       p.id, p.lgd_code, p.name_mr, p.name_en, p.level,
       d.id AS district_id, d.name_mr AS district_name_mr, d.name_en AS district_name_en,
       t.id AS taluka_id, t.name_mr AS taluka_name_mr, t.name_en AS taluka_name_en,
       pf.sarpanch_name, pf.secretary_name, pf.contact_phone,
       pf.elected_committee, pf.updated_at
     FROM panchayats p
     JOIN districts d ON d.id = p.district_id
     JOIN talukas t ON t.id = p.taluka_id
     LEFT JOIN panchayat_profiles pf ON pf.panchayat_id = p.id
     WHERE p.id = $1`,
    [id],
  )) as PanchayatDetailRow[];

  const row = rows[0];
  if (!row) throw notFound('Panchayat not found');

  c.header('Cache-Control', 'public, max-age=3600');
  return c.json({
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
    profile: {
      sarpanchName: row.sarpanch_name,
      secretaryName: row.secretary_name,
      contactPhone: row.contact_phone,
      electedCommittee: row.elected_committee as ElectedMember[] | null,
      updatedAt: row.updated_at,
    },
  } satisfies PanchayatDetail);
});
