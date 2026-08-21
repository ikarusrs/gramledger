import type { Queryable } from '../../src/sinks/postgres.js';

export interface ResolvedIdentity {
  districtId: number;
  talukaId: number;
  panchayatId: number;
}

export interface IdentityResolver {
  resolve(record: {
    stateName?: string;
    districtName?: string;
    blockName?: string;
    panchayatName?: string;
  }): Promise<ResolvedIdentity | undefined>;
}

/**
 * Resolves eGramSwaraj report names to the LGD-based hierarchy by exact match
 * on `name_en`/`name_mr` (district + optional block + panchayat). Results are
 * cached for the run. Unresolved records are dead-lettered upstream.
 */
export function createIdentityResolver(pool: Queryable): IdentityResolver {
  const cache = new Map<string, ResolvedIdentity | undefined>();
  return {
    async resolve(record) {
      const key = [
        record.stateName,
        record.districtName,
        record.blockName,
        record.panchayatName,
      ].join('|');
      if (cache.has(key)) return cache.get(key);
      const result = await resolveNames(pool, record);
      cache.set(key, result);
      return result;
    },
  };
}

async function resolveNames(
  pool: Queryable,
  record: Parameters<IdentityResolver['resolve']>[0],
): Promise<ResolvedIdentity | undefined> {
  if (!record.panchayatName || !record.districtName) return undefined;
  const { rows } = await pool.query(
    `SELECT d.id AS district_id, t.id AS taluka_id, p.id AS panchayat_id
       FROM districts d
       JOIN talukas t ON t.district_id = d.id
       JOIN panchayats p ON p.taluka_id = t.id
       WHERE lower(d.name_en) = lower(
               CASE lower($1)
                 WHEN 'ahilyanagar' THEN 'AHMEDNAGAR'
                 WHEN 'chhatrapati sambhajinagar' THEN 'AURANGABAD'
                 ELSE $1
               END
             )
         AND (lower(p.name_en) = lower($3) OR lower(p.name_mr) = lower($3))
         AND ($2::text IS NULL OR lower(t.name_en) = lower($2) OR lower(t.name_mr) = lower($2))
      LIMIT 1`,
    [record.districtName, record.blockName ?? null, record.panchayatName],
  );
  const row = rows[0] as
    | { district_id: string | number; taluka_id: string | number; panchayat_id: string | number }
    | undefined;
  if (!row) return undefined;
  return {
    districtId: Number(row.district_id),
    talukaId: Number(row.taluka_id),
    panchayatId: Number(row.panchayat_id),
  };
}
