import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadEGramSwarajConfig } from '../sources/egramswaraj/config.js';
import { createEGramSwarajFetcher } from '../sources/egramswaraj/client.js';
import { parseReport } from '../sources/egramswaraj/parser.js';
import { deduplicate, normalize, validate } from '../sources/egramswaraj/stages.js';
import type { EGramSwarajConfig } from '../sources/egramswaraj/types.js';
import { testCtx } from './helpers.js';

const fixture = (name: string): string =>
  readFileSync(resolve('tests/fixtures/egramswaraj', name), 'utf8');

function envelope(html: string) {
  return { url: 'https://egramswaraj.gov.in/report.html', html };
}

describe('eGramSwaraj configuration', () => {
  it('requires a contact email and enforces a polite default interval', () => {
    expect(() => loadEGramSwarajConfig({})).toThrow(/CONTACT_EMAIL/);
    const config = loadEGramSwarajConfig({ ETL_EGS_CONTACT_EMAIL: 'lead@example.org' });
    expect(config.minIntervalMs).toBe(6000);
    expect(config.userAgent).toContain('mailto:lead@example.org');
  });
});

describe('eGramSwaraj HTML parser', () => {
  it('parses a valid report and ignores the total row', () => {
    const result = parseReport(envelope(fixture('district-expenditure.html')));
    expect(result.diagnostics[0]?.warnings).toEqual([]);
    expect(result.records).toHaveLength(2);
    expect(result.records[0]).toMatchObject({
      kind: 'district_expenditure',
      financialYear: 2025,
      districtName: 'Pune',
      receipts: 3237.13,
      payments: 1665.94,
    });
  });

  it('tolerates reordered columns, whitespace, and extra columns', () => {
    const result = parseReport(envelope(fixture('changed-layout.html')));
    expect(result.records).toHaveLength(1);
    expect(result.records[0]?.districtName).toBe('Pune');
    expect(result.records[0]?.receipts).toBe(947.414);
    expect(result.records[0]?.payments).toBe(5.329);
  });

  it('parses missing fields without throwing so validation can reject them', () => {
    const result = parseReport(envelope(fixture('missing-fields.html')));
    expect(result.records).toHaveLength(1);
    expect(result.records[0]?.payments).toBe(-5);
  });

  it('reports parser drift when the report type or year disappears', () => {
    const result = parseReport(
      envelope('<html><body><table><tr><td>unexpected</td></tr></table></body></html>'),
    );
    expect(result.records).toHaveLength(0);
    expect(result.diagnostics[0]?.warnings).toContain('financial year not found');
  });
});

describe('eGramSwaraj stages', () => {
  it('validates, normalizes, and rejects negative values', async () => {
    const parsed = parseReport(envelope(fixture('missing-fields.html'))).records;
    const outcome = await validate(parsed, testCtx('validate'));
    expect(outcome.valid).toHaveLength(0);
    expect(outcome.invalid[0]?.errors).toContain('payments must be non-negative');
  });

  it('deduplicates natural keys', async () => {
    const record = parseReport(envelope(fixture('district-expenditure.html'))).records[0]!;
    const { kept, removed } = await deduplicate([record, { ...record }], testCtx('deduplicate'));
    expect(kept).toHaveLength(1);
    expect(removed).toHaveLength(1);
  });

  it('normalizes names and money precision', async () => {
    const record = {
      ...parseReport(envelope(fixture('district-expenditure.html'))).records[0]!,
      districtName: ' Pune   ',
    };
    const [normalized] = await normalize([record], testCtx('normalize'));
    expect(normalized?.districtName).toBe('Pune');
    expect(normalized?.receipts).toBe(3237.13);
  });
});

describe('eGramSwaraj fetcher', () => {
  it('uses the transparent user agent, timeout-capable request, and rate hook', async () => {
    const config: EGramSwarajConfig = {
      baseUrl: 'https://egramswaraj.gov.in/',
      reportUrls: ['report.html', 'second.html'],
      userAgent: 'GramLedger-test (+mailto:test@example.org)',
      minIntervalMs: 10,
      timeoutMs: 1000,
      maxPages: 20,
    };
    const calls: string[] = [];
    const fetchFn: typeof fetch = async (input, init) => {
      calls.push(String(input));
      expect(new Headers(init?.headers).get('user-agent')).toContain('mailto:test@example.org');
      return new Response(fixture('district-expenditure.html'), {
        status: 200,
        headers: { 'content-type': 'text/html' },
      });
    };
    const result = await createEGramSwarajFetcher(config, { fetchFn, sleep: async () => {} })(
      testCtx('fetch'),
    );
    expect(calls).toHaveLength(2);
    expect(JSON.parse(result.content)).toHaveLength(2);
  });
});
