import type { Normalizer, Parser } from '../../src/core/types.js';
import type { MandiPriceRecord, RawApiRecord } from './types.js';

/** Key that identifies a record; used by deduplicate and the natural key. */
export function naturalKey(record: MandiPriceRecord): string {
  return [
    record.districtLgdCode ?? '',
    record.market,
    record.commodity,
    record.variety,
    record.grade,
    record.priceDate,
  ].join(':');
}

/**
 * Converts the API's `DD/MM/YYYY` arrival date to ISO `YYYY-MM-DD`, or returns
 * `null` when the value is not a real calendar date.
 */
export function parseArrivalDate(value: string): string | null {
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value.trim());
  if (!match) return null;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return date.toISOString().slice(0, 10);
}

function numberOrNaN(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : NaN;
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/** Maps a raw API record onto the internal shape; prices default to NaN, dates to ''. */
export function mapRawRecord(raw: RawApiRecord): MandiPriceRecord {
  return {
    state: text(raw.state),
    district: text(raw.district),
    market: text(raw.market),
    commodity: text(raw.commodity),
    variety: text(raw.variety),
    grade: text(raw.grade) || 'other',
    priceDate: parseArrivalDate(text(raw.arrival_date)) ?? '',
    minPrice: numberOrNaN(raw.min_price),
    maxPrice: numberOrNaN(raw.max_price),
    modalPrice: numberOrNaN(raw.modal_price),
  };
}

/** Parse stage: deserializes the fetch content and maps each raw record. */
export const parseContent: Parser<MandiPriceRecord> = async (input) => {
  let body: { records?: RawApiRecord[] };
  try {
    body = JSON.parse(input.content) as { records?: RawApiRecord[] };
  } catch (cause) {
    throw new Error(`data.gov.in fetch content is not valid JSON: ${String(cause)}`);
  }
  if (!Array.isArray(body.records)) {
    throw new Error('data.gov.in fetch content is missing the records array');
  }
  return body.records.map(mapRawRecord);
};

/** Normalize stage: canonical name casing/whitespace and price sanitization. */
export const normalize: Normalizer<MandiPriceRecord> = async (records) =>
  records.map((record) => ({
    ...record,
    state: record.state.trim(),
    district: record.district.trim(),
    market: collapseWhitespace(record.market),
    commodity: collapseWhitespace(record.commodity),
    variety: collapseWhitespace(record.variety),
    grade: record.grade.trim() || 'other',
    minPrice: Math.max(0, record.minPrice),
    maxPrice: Math.max(0, record.maxPrice),
    modalPrice: Math.max(0, record.modalPrice),
  }));

/** Reduces runs of whitespace to a single space (names arrive Title-cased already). */
function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

/** Deduplicates records on the natural key (keeps the first occurrence). */
export async function deduplicate(
  records: MandiPriceRecord[],
): Promise<{ kept: MandiPriceRecord[]; removed: MandiPriceRecord[] }> {
  const seen = new Set<string>();
  const kept: MandiPriceRecord[] = [];
  const removed: MandiPriceRecord[] = [];
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
