import type { ValidationOutcome, Validator } from '../../src/core/types.js';
import type { LgdRow } from './types.js';

/**
 * Validates records syntactically. Every hierarchy level above the village
 * (state/district/taluk) must carry a positive code and a name; the local body
 * is optional — a village may exist before it is mapped to a Gram Panchayat —
 * but when a local body code is present its name must be too.
 */
export function createValidator(): Validator<LgdRow> {
  return async (records): Promise<ValidationOutcome<LgdRow>> => {
    const valid: LgdRow[] = [];
    const invalid: Array<{ record: LgdRow; errors: string[] }> = [];

    for (const record of records) {
      const errors = checkRecord(record);
      if (errors.length > 0) {
        invalid.push({ record, errors });
      } else {
        valid.push(record);
      }
    }
    return { valid, invalid };
  };
}

function checkRecord(record: LgdRow): string[] {
  const errors: string[] = [];
  for (const [code, label] of [
    [record.stateCode, 'state'],
    [record.districtCode, 'district'],
    [record.talukCode, 'sub-district'],
    [record.villageCode, 'village'],
  ] as const) {
    if (!Number.isInteger(code) || code <= 0) errors.push(`${label} code is required`);
  }
  for (const [value, label] of [
    [record.stateName, 'state'],
    [record.districtName, 'district'],
    [record.talukName, 'sub-district'],
    [record.villageName, 'village'],
  ] as const) {
    if (!value) errors.push(`${label} name is required`);
  }
  if (record.panchayatCode !== null && !record.panchayatName) {
    errors.push('local body name is required when a local body code is present');
  }
  return errors;
}
