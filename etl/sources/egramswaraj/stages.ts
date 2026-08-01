import type {
  Deduplicator,
  Normalizer,
  Transformer,
  ValidationOutcome,
  Validator,
} from '../../src/core/types.js';
import type { EGramRecord } from './types.js';

export const validate: Validator<EGramRecord> = async (
  records,
): Promise<ValidationOutcome<EGramRecord>> => {
  const valid: EGramRecord[] = [];
  const invalid: ValidationOutcome<EGramRecord>['invalid'] = [];
  for (const record of records) {
    const errors: string[] = [];
    if (!record.kind) errors.push('kind is required');
    if (
      !Number.isInteger(record.financialYear) ||
      record.financialYear < 2000 ||
      record.financialYear > 2100
    ) {
      errors.push('financialYear is invalid');
    }
    if (!record.sourceUrl) errors.push('sourceUrl is required');
    if (record.receipts !== undefined && record.receipts < 0)
      errors.push('receipts must be non-negative');
    if (record.payments !== undefined && record.payments < 0)
      errors.push('payments must be non-negative');
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
    panchayatName: normalizeName(record.panchayatName),
    schemeName: normalizeName(record.schemeName),
    title: normalizeName(record.title),
    category: normalizeName(record.category),
    description: normalizeName(record.description),
    receipts: roundMoney(record.receipts),
    payments: roundMoney(record.payments),
    amount: roundMoney(record.amount),
  }));

export const deduplicate: Deduplicator<EGramRecord> = async (records) => {
  const seen = new Set<string>();
  const kept: EGramRecord[] = [];
  const removed: EGramRecord[] = [];
  for (const record of records) {
    const key = `${record.kind}|${record.financialYear}|${record.stateName ?? ''}|${record.districtName ?? ''}|${record.panchayatName ?? ''}|${record.schemeName ?? ''}|${record.title ?? record.category ?? ''}`;
    if (seen.has(key)) removed.push(record);
    else {
      seen.add(key);
      kept.push(record);
    }
  }
  return { kept, removed };
};

/** Keeps only records with a panchayat identity for the future normalized loader. */
export const transform: Transformer<EGramRecord> = async (records, ctx) => {
  const eligible = records.filter(
    (record) => record.panchayatCode !== undefined || record.panchayatName,
  );
  const skipped = records.length - eligible.length;
  if (skipped > 0) {
    ctx.log.warn('eGramSwaraj records lack panchayat identity; loader deferred', { skipped });
    ctx.metrics.increment('transform.missing_panchayat_identity', skipped);
  }
  return eligible;
};

function normalizeName(value: string | undefined): string | undefined {
  return value?.replace(/\s+/g, ' ').trim() || undefined;
}

function roundMoney(value: number | undefined): number | undefined {
  return value === undefined ? undefined : Math.round(value * 100) / 100;
}
