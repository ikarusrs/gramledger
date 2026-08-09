import type { Normalizer, Parser } from '../../src/core/types.js';
import type { LgdRow, PanchayatLevel, RawLgdRecord } from './types.js';

/** Key that identifies a record; used by deduplicate. */
export function naturalKey(record: LgdRow): string {
  return [record.villageCode, record.panchayatCode ?? ''].join(':');
}

/** LGD local-body types map onto the three panchayat tiers. */
function levelFromType(type: string | null | undefined): PanchayatLevel {
  const t = (type ?? '').toLowerCase();
  if (t.includes('district')) return 'district';
  if (t.includes('block') || t.includes('samiti')) return 'block';
  return 'gram';
}

/**
 * Parses an LGD code. Codes arrive zero-padded strings (e.g. `'000052'`),
 * numbers, or the sentinel `'None'`/null for unmapped local bodies.
 */
export function parseLgdCode(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const raw = String(value).trim();
  if (raw === '' || /^none$/i.test(raw)) return null;
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function text(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

/** Maps a raw portal record onto the internal row shape; codes parse to numbers. */
export function mapRawRecord(raw: RawLgdRecord): LgdRow {
  const panchayatCode = parseLgdCode(raw.local_body_code);
  return {
    stateCode: parseLgdCode(raw.state_code) ?? 0,
    stateName: text(raw.state_name),
    districtCode: parseLgdCode(raw.district_code) ?? 0,
    districtName: text(raw.district_name),
    talukCode: parseLgdCode(raw.sub_district_code) ?? 0,
    talukName: text(raw.sub_district_name),
    panchayatCode,
    panchayatName: panchayatCode === null ? null : text(raw.local_body_name) || null,
    panchayatLevel: levelFromType(raw.local_body_type),
    villageCode: parseLgdCode(raw.village_code) ?? 0,
    villageName: text(raw.village_name),
  };
}

/** Parse stage: deserializes the fetch content and maps each raw record. */
export const parseContent: Parser<LgdRow> = async (input) => {
  let body: { records?: RawLgdRecord[] };
  try {
    body = JSON.parse(input.content) as { records?: RawLgdRecord[] };
  } catch (cause) {
    throw new Error(`LGD fetch content is not valid JSON: ${String(cause)}`);
  }
  if (!Array.isArray(body.records)) {
    throw new Error('LGD fetch content is missing the records array');
  }
  return body.records.map(mapRawRecord);
};

/** Normalize stage: canonical name casing/whitespace. */
export const normalize: Normalizer<LgdRow> = async (records) =>
  records.map((record) => ({
    ...record,
    stateName: collapseWhitespace(record.stateName),
    districtName: collapseWhitespace(record.districtName),
    talukName: collapseWhitespace(record.talukName),
    panchayatName: record.panchayatName === null ? null : collapseWhitespace(record.panchayatName),
    villageName: collapseWhitespace(record.villageName),
  }));

/** Reduces runs of whitespace to a single space. */
function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

/** Deduplicates records on the natural key (keeps the first occurrence). */
export async function deduplicate(
  records: LgdRow[],
): Promise<{ kept: LgdRow[]; removed: LgdRow[] }> {
  const seen = new Set<string>();
  const kept: LgdRow[] = [];
  const removed: LgdRow[] = [];
  for (const record of records) {
    const key = naturalKey(record);
    if (seen.has(key)) {
      removed.push(record);
      continue;
    }
    seen.add(key);
    kept.push(record);
  }
  return { kept, removed };
}
