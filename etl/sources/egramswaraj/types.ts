import type { ETLRecord } from '../../src/core/types.js';

export type EGramReportKind = 'monthly_statement' | 'village_statement' | 'scheme_village';

/** Report family this row came from; stored in `source`. */
export const SOURCE_MONTHLY = 'egramswaraj_monthly';
export const SOURCE_VILLAGE = 'egramswaraj_village';
export const SOURCE_SCHEME = 'egramswaraj_scheme';

export interface EGramSwarajConfig {
  baseUrl: string;
  reportUrls: string[];
  userAgent: string;
  minIntervalMs: number;
  timeoutMs: number;
  maxPages: number;
}

export interface EGramReportEnvelope {
  url: string;
  html: string;
}

export interface EGramRecord extends ETLRecord {
  kind: EGramReportKind;
  source: string;
  financialYear: number;
  /** Raw period label ("April 2025", "opening_balance", or "total"). */
  period: string;
  /** Fiscal-year month number (April = 1 … March = 12) for monthly rows. */
  monthNo?: number;
  sourceUrl: string;
  sourceHash: string;
  stateName?: string;
  districtName?: string;
  blockName?: string;
  panchayatName?: string;
  /** Scheme name for scheme-wise expirations. */
  scheme?: string;
  openingBalance?: number;
  receipts?: number;
  receiptCancellation?: number;
  obCancellation?: number;
  payments?: number;
  paymentCancellation?: number;
  raw: Record<string, string>;
}

export interface ParseDiagnostics {
  kind: EGramReportKind | 'skipped' | 'unknown';
  warnings: string[];
  tablesSeen: number;
  rowsSeen: number;
}
