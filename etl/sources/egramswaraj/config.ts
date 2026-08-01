import { ETLError } from '../../src/core/errors.js';
import type { EGramSwarajConfig } from './types.js';

export type EnvLike = Record<string, string | undefined>;

const DEFAULT_REPORTS = [
  'FileRedirect.jsp?FD=ExpenditureReport2025-2026/27&name=27.html',
  'FileRedirect.jsp?FD=SummaryReport2025-2026/27&name=27.html',
];

export function loadEGramSwarajConfig(env: EnvLike = process.env): EGramSwarajConfig {
  const contact = env.ETL_EGS_CONTACT_EMAIL?.trim();
  if (!contact) {
    throw new ETLError('CONFIG_ERROR', 'ETL_EGS_CONTACT_EMAIL is required');
  }
  const reportUrls = (env.ETL_EGS_REPORT_URLS ?? DEFAULT_REPORTS.join(','))
    .split(',')
    .map((url) => url.trim())
    .filter(Boolean);
  if (reportUrls.length === 0) {
    throw new ETLError('CONFIG_ERROR', 'ETL_EGS_REPORT_URLS must contain one URL');
  }
  return {
    baseUrl: env.ETL_EGS_BASE_URL ?? 'https://egramswaraj.gov.in/',
    reportUrls,
    userAgent: `GramLedger-eGramSwaraj/0.1 (+mailto:${contact})`,
    minIntervalMs: positiveInt('ETL_EGS_MIN_INTERVAL_MS', 6_000, env),
    timeoutMs: positiveInt('ETL_EGS_TIMEOUT_MS', 30_000, env),
    maxPages: positiveInt('ETL_EGS_MAX_PAGES', 20, env),
  };
}

function positiveInt(name: string, fallback: number, env: EnvLike): number {
  const raw = env[name];
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) {
    throw new ETLError('CONFIG_ERROR', `${name} must be a positive integer`);
  }
  return value;
}
