import type { Queryable } from '../../src/sinks/postgres.js';
import type { DistrictResolver } from './types.js';

/**
 * District resolver backed by the `districts` hierarchy table. Lookup is by
 * `name_en`, matched case-insensitively; names absent from the hierarchy simply
 * return no mapping and the validate stage dead-letters those records.
 */
export function createDistrictResolver(pool: Queryable): DistrictResolver {
  return async (names) => {
    const unique = [...new Set(names.map((name) => name.trim()).filter(Boolean))];
    if (unique.length === 0) return new Map<string, number>();
    const { rows } = await pool.query(
      'SELECT lgd_code, name_en FROM districts WHERE LOWER(name_en) = ANY($1)',
      [unique.map((name) => name.toLowerCase())],
    );
    const map = new Map<string, number>();
    for (const row of rows as Array<{ lgd_code: string | number; name_en: string }>) {
      map.set(row.name_en.trim().toLowerCase(), Number(row.lgd_code));
    }
    return map;
  };
}
