import type { ValidationOutcome, Validator } from '../../src/core/types.js';
import type { DistrictResolver, MandiPriceRecord } from './types.js';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Validates records and resolves their district LGD codes in one batched query.
 * Records that fail syntactically, carry prices that violate ordering, or map to
 * a district missing from the hierarchy are returned as `invalid` (the pipeline
 * dead-letters them); the rest get `districtLgdCode` set.
 */
export function createValidator(resolveDistricts: DistrictResolver): Validator<MandiPriceRecord> {
  return async (records): Promise<ValidationOutcome<MandiPriceRecord>> => {
    const today = new Date().toISOString().slice(0, 10);
    const invalid: Array<{ record: MandiPriceRecord; errors: string[] }> = [];
    const syntacticallyValid: MandiPriceRecord[] = [];

    for (const record of records) {
      const errors = checkRecord(record, today);
      if (errors.length > 0) {
        invalid.push({ record, errors });
      } else {
        syntacticallyValid.push(record);
      }
    }

    const resolution = await resolveDistricts(syntacticallyValid.map((r) => r.district));
    const valid: MandiPriceRecord[] = [];
    for (const record of syntacticallyValid) {
      const lgd = resolution.get(record.district.trim().toLowerCase());
      if (lgd === undefined) {
        invalid.push({
          record,
          errors: [`district '${record.district}' not found in hierarchy`],
        });
      } else {
        valid.push({ ...record, districtLgdCode: lgd });
      }
    }
    return { valid, invalid };
  };
}

function checkRecord(record: MandiPriceRecord, today: string): string[] {
  const errors: string[] = [];
  for (const field of ['state', 'district', 'market', 'commodity', 'variety'] as const) {
    if (!record[field]) errors.push(`${field} is required`);
  }

  if (!record.priceDate) {
    errors.push('arrival_date must be a valid DD/MM/YYYY date');
  } else if (!ISO_DATE.test(record.priceDate)) {
    errors.push(`invalid arrival date '${record.priceDate}'`);
  } else if (record.priceDate > today) {
    errors.push(`arrival date '${record.priceDate}' is in the future`);
  }

  for (const [name, value] of [
    ['min_price', record.minPrice],
    ['max_price', record.maxPrice],
    ['modal_price', record.modalPrice],
  ] as const) {
    if (!Number.isFinite(value)) {
      errors.push(`${name} must be a number`);
    } else if (value < 0) {
      errors.push(`${name} must be >= 0`);
    }
  }
  if (
    Number.isFinite(record.minPrice) &&
    Number.isFinite(record.maxPrice) &&
    record.maxPrice < record.minPrice
  ) {
    errors.push('max_price must be >= min_price');
  }
  return errors;
}
