import type {
  Deduplicator,
  Normalizer,
  Transformer,
  ValidationOutcome,
  Validator,
} from '../../src/core/types.js';
import type { IdentityResolver } from './resolver.js';
import type { EGramRecord } from './types.js';

const MONEY_FIELDS = [
  'openingBalance',
  'receipts',
  'receiptCancellation',
  'obCancellation',
  'payments',
  'paymentCancellation',
] as const;

export const validate: Validator<EGramRecord> = async (
  records,
): Promise<ValidationOutcome<EGramRecord>> => {
  const valid: EGramRecord[] = [];
  const invalid: ValidationOutcome<EGramRecord>['invalid'] = [];
  for (const record of records) {
    const errors: string[] = [];
    if (!['monthly_statement', 'village_statement'].includes(record.kind)) {
      errors.push(`kind ${record.kind} is not supported`);
    }
    if (
      !Number.isInteger(record.financialYear) ||
      record.financialYear < 2000 ||
      record.financialYear > 2100
    ) {
      errors.push('financialYear is invalid');
    }
    if (!record.period) errors.push('period is required');
    if (!record.sourceUrl) errors.push('sourceUrl is required');
    if (!record.panchayatName) errors.push('panchayatName is required');
    if (record.monthNo !== undefined && !(record.monthNo >= 1 && record.monthNo <= 12)) {
      errors.push('monthNo is invalid');
    }
    for (const field of MONEY_FIELDS) {
      const value = record[field];
      if (value !== undefined && value < 0) errors.push(`${field} must be non-negative`);
    }
    if (errors.length > 0) invalid.push({ record, errors });
    else valid.push(record);
  }
  return { valid, invalid };
};

export const normalize: Normalizer<EGramRecord> = async (records) =>
  records.map((record) => ({
    ...record,
    stateName: normalizeName(record.stateName),
    districtName: normalizeName(record.districtName),
    blockName: normalizeName(record.blockName),
    panchayatName: normalizeName(record.panchayatName),
    period: record.period.trim(),
    openingBalance: roundMoney(record.openingBalance),
    receipts: roundMoney(record.receipts),
    receiptCancellation: roundMoney(record.receiptCancellation),
    obCancellation: roundMoney(record.obCancellation),
    payments: roundMoney(record.payments),
    paymentCancellation: roundMoney(record.paymentCancellation),
  }));

export const deduplicate: Deduplicator<EGramRecord> = async (records) => {
  const seen = new Set<string>();
  const kept: EGramRecord[] = [];
  const removed: EGramRecord[] = [];
  for (const record of records) {
    const key = [
      record.source,
      record.financialYear,
      record.period,
      record.stateName ?? '',
      record.districtName ?? '',
      record.blockName ?? '',
      record.panchayatName ?? '',
    ].join('|');
    if (seen.has(key)) removed.push(record);
    else {
      seen.add(key);
      kept.push(record);
    }
  }
  return { kept, removed };
};

/**
 * Resolves scraped names to database ids and drops records that cannot be
 * matched to a panchayat (counted as skipped by the pipeline).
 */
export function createResolvingTransform(resolve: IdentityResolver): Transformer<EGramRecord> {
  return async (records, ctx) => {
    const kept: EGramRecord[] = [];
    for (const record of records) {
      const identity = await resolve.resolve(record);
      if (identity === undefined) {
        ctx.metrics.increment('transform.unresolved_panchayat');
        ctx.log.warn('eGramSwaraj record could not be resolved to a panchayat', {
          state: record.stateName,
          district: record.districtName,
          block: record.blockName,
          panchayat: record.panchayatName,
        });
        continue;
      }
      kept.push({ ...record, ...identity });
    }
    return kept;
  };
}

function normalizeName(value: string | undefined): string | undefined {
  return value?.replace(/\s+/g, ' ').trim() || undefined;
}

function roundMoney(value: number | undefined): number | undefined {
  return value === undefined ? undefined : Math.round(value * 100) / 100;
}
