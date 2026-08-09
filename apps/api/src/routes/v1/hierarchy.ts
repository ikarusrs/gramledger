import { Hono } from 'hono';
import type { AppEnv } from '../../config';
import type { Db, Row } from '../../lib/db';
import { serviceUnavailable } from '../../lib/errors';

/** Response shapes mirror the web contract (`apps/web/src/lib/api/types.ts`). */

export interface NamedEntity {
  id: number;
  lgdCode: string;
  nameMr: string;
  nameEn: string;
}

export interface Village extends NamedEntity {
  panchayatId: number | null;
}

export interface Taluka extends NamedEntity {
  villages: Village[];
}

export interface District extends NamedEntity {
  talukas: Taluka[];
}

export interface Hierarchy {
  districts: District[];
}

interface VillageRow extends Row {
  village_id: string;
  village_code: string;
  village_name_mr: string;
  village_name_en: string;
  panchayat_id: string | null;
  taluka_id: string;
  taluka_code: string;
  taluka_name_mr: string;
  taluka_name_en: string;
  district_id: string;
  district_code: string;
  district_name_mr: string;
  district_name_en: string;
}

const HIERARCHY_SQL = `
  SELECT
    v.id AS village_id, v.lgd_code AS village_code,
    v.name_mr AS village_name_mr, v.name_en AS village_name_en, v.panchayat_id,
    t.id AS taluka_id, t.lgd_code AS taluka_code,
    t.name_mr AS taluka_name_mr, t.name_en AS taluka_name_en,
    d.id AS district_id, d.lgd_code AS district_code,
    d.name_mr AS district_name_mr, d.name_en AS district_name_en
  FROM villages v
  JOIN talukas t ON t.id = v.taluka_id
  JOIN districts d ON d.id = t.district_id
  ORDER BY d.name_en, t.name_en, v.name_en
`;

export const hierarchyRouter = new Hono<AppEnv>();

hierarchyRouter.get('/hierarchy', async (c) => {
  const db = c.get('db') as Db | undefined;
  if (!db) throw serviceUnavailable();

  const rows = (await db.query(HIERARCHY_SQL)) as VillageRow[];
  const districts = new Map<number, District>();

  for (const row of rows) {
    const districtId = Number(row.district_id);
    let district = districts.get(districtId);
    if (!district) {
      district = {
        id: districtId,
        lgdCode: String(row.district_code),
        nameMr: row.district_name_mr,
        nameEn: row.district_name_en,
        talukas: [],
      };
      districts.set(districtId, district);
    }

    const talukaId = Number(row.taluka_id);
    let taluka = district.talukas.find((t) => t.id === talukaId);
    if (!taluka) {
      taluka = {
        id: talukaId,
        lgdCode: String(row.taluka_code),
        nameMr: row.taluka_name_mr,
        nameEn: row.taluka_name_en,
        villages: [],
      };
      district.talukas.push(taluka);
    }

    taluka.villages.push({
      id: Number(row.village_id),
      lgdCode: String(row.village_code),
      nameMr: row.village_name_mr,
      nameEn: row.village_name_en,
      panchayatId: row.panchayat_id != null ? Number(row.panchayat_id) : null,
    });
  }

  c.header('Cache-Control', 'public, max-age=3600');
  return c.json({ districts: [...districts.values()] } satisfies Hierarchy);
});
