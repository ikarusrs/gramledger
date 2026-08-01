import type { ETLRecord } from '../../src/core/types.js';

export type EGramReportKind =
  'district_expenditure' | 'scheme_expenditure' | 'panchayat_profile' | 'public_work' | 'asset';

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
  financialYear: number;
  sourceUrl: string;
  sourceHash: string;
  stateName?: string;
  stateCode?: number;
  districtName?: string;
  districtCode?: number;
  panchayatName?: string;
  panchayatCode?: number;
  schemeName?: string;
  schemeCode?: string;
  title?: string;
  status?: string;
  amount?: number;
  receipts?: number;
  payments?: number;
  sanctionedAmount?: number;
  spentAmount?: number;
  startDate?: string;
  endDate?: string;
  category?: string;
  description?: string;
  raw: Record<string, string>;
}

export interface ParseDiagnostics {
  kind: EGramReportKind | 'unknown';
  warnings: string[];
  tablesSeen: number;
  rowsSeen: number;
}
