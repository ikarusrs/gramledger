import type { Loader, LoadResult } from '../../src/core/types.js';
import type { Queryable } from '../../src/sinks/postgres.js';
import type { LgdRow, PanchayatLevel } from './types.js';

/**
 * LGD hierarchy loader. A single village record carries its whole chain
 * (state → district → sub-district/taluka → Gram Panchayat → village), so one
 * pipeline run fans records out into all five hierarchy tables in FK order:
 *
 *   states → districts → talukas → panchayats → villages
 *
 * Parent FKs are resolved inside SQL by joining the already-upserted parent
 * table on `lgd_code`; every statement is idempotent via `ON CONFLICT
 * (lgd_code)`. The `name_mr` column receives a copy of the English name as a
 * placeholder (LGD ships English-only); a later transliteration pass replaces
 * it.
 */
export function createHierarchyLoader(pool: Queryable): Loader<LgdRow> {
  return async (records): Promise<LoadResult> => {
    if (records.length === 0) return { upserted: 0 };

    const states = distinct(records, (r) => ({ code: r.stateCode, name: r.stateName }));
    const districts = distinct(records, (r) => ({
      code: r.districtCode,
      name: r.districtName,
      parentCode: r.stateCode,
    }));
    const talukas = distinct(records, (r) => ({
      code: r.talukCode,
      name: r.talukName,
      parentCode: r.districtCode,
    }));
    const panchayats = distinct(
      records.filter((r) => r.panchayatCode !== null),
      (r) => ({
        code: r.panchayatCode!,
        name: r.panchayatName!,
        stateCode: r.stateCode,
        districtCode: r.districtCode,
        talukCode: r.talukCode,
        level: r.panchayatLevel,
      }),
    );
    const villages = distinct(records, (r) => ({
      code: r.villageCode,
      name: r.villageName,
      talukCode: r.talukCode,
      panchayatCode: r.panchayatCode,
    }));

    await upsertStates(pool, states);
    await upsertWithParent(pool, 'districts', 'state_id', 'states', districts);
    await upsertWithParent(pool, 'talukas', 'district_id', 'districts', talukas);
    await upsertPanchayats(pool, panchayats);
    const villageCount = await upsertVillages(pool, villages);

    return { upserted: villageCount, inserted: villageCount, updated: villageCount };
  };
}

interface SimpleEntry {
  code: number;
  name: string;
  parentCode?: number;
}

interface PanchayatEntry extends SimpleEntry {
  stateCode: number;
  districtCode: number;
  talukCode: number;
  level: PanchayatLevel;
}

interface VillageEntry extends SimpleEntry {
  talukCode: number;
  panchayatCode: number | null;
}

/** Groups rows by LGD code, keeping the first occurrence in the batch. */
function distinct<T extends SimpleEntry>(records: LgdRow[], pick: (r: LgdRow) => T): T[] {
  const map = new Map<number, T>();
  for (const record of records) {
    const entry = pick(record);
    if (entry.code > 0 && !map.has(entry.code)) map.set(entry.code, entry);
  }
  return [...map.values()];
}

/** `INSERT … SELECT … FROM (VALUES …) JOIN` for one batch. */
function valuesClause(columns: string[], rows: unknown[][]): { sql: string; params: unknown[] } {
  const bigintColumns = new Set([
    'lgd_code',
    'parent_code',
    'panchayat_code',
    'state_code',
    'district_code',
    'taluk_code',
  ]);
  const params: unknown[] = [];
  const tuples = rows.map((row) => {
    const placeholders = columns.map((col, i) => {
      params.push(row[i]);
      const cast = bigintColumns.has(col) ? '::bigint' : '';
      return `$${params.length}${cast}`;
    });
    return `(${placeholders.join(', ')})`;
  });
  return { sql: `(VALUES ${tuples.join(', ')}) AS v(${columns.join(', ')})`, params };
}

/** Upserts the FK-less `states` table. */
async function upsertStates(pool: Queryable, states: SimpleEntry[]): Promise<number> {
  if (states.length === 0) return 0;
  const { sql, params } = valuesClause(
    ['lgd_code', 'name_mr', 'name_en'],
    states.map((s) => [s.code, s.name, s.name]),
  );
  const query = `
    INSERT INTO states (lgd_code, name_mr, name_en)
    SELECT v.lgd_code, v.name_mr, v.name_en
    FROM ${sql}
    ON CONFLICT (lgd_code) DO UPDATE SET
      name_mr = EXCLUDED.name_mr,
      name_en = EXCLUDED.name_en
  `;
  const result = await pool.query(query, params);
  return result.rowCount ?? 0;
}

/**
 * Upserts a table whose FK is its single parent level (`districts`,
 * `talukas`). The parent id is resolved by joining the parent table on
 * `lgd_code`.
 */
async function upsertWithParent(
  pool: Queryable,
  table: 'districts' | 'talukas',
  parentColumn: 'state_id' | 'district_id',
  parentTable: 'states' | 'districts',
  rows: SimpleEntry[],
): Promise<number> {
  if (rows.length === 0) return 0;
  const { sql, params } = valuesClause(
    ['lgd_code', 'name_mr', 'name_en', 'parent_code'],
    rows.map((r) => [r.code, r.name, r.name, r.parentCode]),
  );
  const query = `
    INSERT INTO ${table} (${parentColumn}, lgd_code, name_mr, name_en)
    SELECT p.id, v.lgd_code, v.name_mr, v.name_en
    FROM ${sql}
    JOIN ${parentTable} p ON p.lgd_code = v.parent_code
    ON CONFLICT (lgd_code) DO UPDATE SET
      ${parentColumn} = EXCLUDED.${parentColumn},
      name_mr = EXCLUDED.name_mr,
      name_en = EXCLUDED.name_en
  `;
  const result = await pool.query(query, params);
  return result.rowCount ?? 0;
}

/** Upserts `panchayats`, resolving all three FKs from the record's chain. */
async function upsertPanchayats(pool: Queryable, rows: PanchayatEntry[]): Promise<number> {
  if (rows.length === 0) return 0;
  const { sql, params } = valuesClause(
    ['lgd_code', 'name_mr', 'name_en', 'level', 'state_code', 'district_code', 'taluk_code'],
    rows.map((r) => [r.code, r.name, r.name, r.level, r.stateCode, r.districtCode, r.talukCode]),
  );
  const query = `
    INSERT INTO panchayats (state_id, district_id, taluka_id, lgd_code, name_mr, name_en, level)
    SELECT s.id, d.id, t.id, v.lgd_code, v.name_mr, v.name_en, v.level
    FROM ${sql}
    JOIN states s ON s.lgd_code = v.state_code
    JOIN districts d ON d.lgd_code = v.district_code
    JOIN talukas t ON t.lgd_code = v.taluk_code
    ON CONFLICT (lgd_code) DO UPDATE SET
      state_id = EXCLUDED.state_id,
      district_id = EXCLUDED.district_id,
      taluka_id = EXCLUDED.taluka_id,
      name_mr = EXCLUDED.name_mr,
      name_en = EXCLUDED.name_en,
      level = EXCLUDED.level
  `;
  const result = await pool.query(query, params);
  return result.rowCount ?? 0;
}

/** Upserts `villages`; `panchayat_id` is nullable and resolved when present. */
async function upsertVillages(pool: Queryable, rows: VillageEntry[]): Promise<number> {
  if (rows.length === 0) return 0;
  const { sql, params } = valuesClause(
    ['lgd_code', 'name_mr', 'name_en', 'taluk_code', 'panchayat_code'],
    rows.map((r) => [r.code, r.name, r.name, r.talukCode, r.panchayatCode]),
  );
  const query = `
    INSERT INTO villages (taluka_id, panchayat_id, lgd_code, name_mr, name_en)
    SELECT t.id, p.id, v.lgd_code, v.name_mr, v.name_en
    FROM ${sql}
    JOIN talukas t ON t.lgd_code = v.taluk_code
    LEFT JOIN panchayats p ON p.lgd_code = v.panchayat_code
    ON CONFLICT (lgd_code) DO UPDATE SET
      taluka_id = EXCLUDED.taluka_id,
      panchayat_id = EXCLUDED.panchayat_id,
      name_mr = EXCLUDED.name_mr,
      name_en = EXCLUDED.name_en
  `;
  const result = await pool.query(query, params);
  return result.rowCount ?? 0;
}
