import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadEGramSwarajConfig } from '../sources/egramswaraj/config.js';
import { createEGramSwarajFetcher } from '../sources/egramswaraj/client.js';
import { parseReport } from '../sources/egramswaraj/parser.js';
import {
  createResolvingTransform,
  deduplicate,
  normalize,
  validate,
} from '../sources/egramswaraj/stages.js';
import { createIdentityResolver } from '../sources/egramswaraj/resolver.js';
import { buildEGramSwarajPipeline } from '../sources/egramswaraj/index.js';
import {
  detectLevel,
  monthFromLabel,
  parseFinancialYear,
  parseMoney,
} from '../sources/egramswaraj/html.js';
import type { EGramSwarajConfig } from '../sources/egramswaraj/types.js';
import { SOURCE_MONTHLY, SOURCE_SCHEME, SOURCE_VILLAGE } from '../sources/egramswaraj/types.js';
import type { IdentityResolver } from '../sources/egramswaraj/resolver.js';
import { memoryAudit, memoryDeadLetter, testConfig, testCtx } from './helpers.js';

const fixture = (name: string): string =>
  readFileSync(resolve('tests/fixtures/egramswaraj', name), 'utf8');

function envelope(html: string, url = 'https://egramswaraj.gov.in/report.html') {
  return { url, html };
}

function sourceConfig(overrides: Partial<EGramSwarajConfig> = {}): EGramSwarajConfig {
  return {
    baseUrl: 'https://egramswaraj.gov.in/',
    reportUrls: ['FileRedirect.jsp?FD=ExpenditureReport2025-2026/27/424&name=424.html'],
    userAgent: 'GramLedger-test (+mailto:test@example.org)',
    minIntervalMs: 10,
    timeoutMs: 1000,
    maxPages: 20,
    ...overrides,
  };
}

describe('eGramSwaraj configuration', () => {
  it('requires a contact email and enforces a polite default interval', () => {
    expect(() => loadEGramSwarajConfig({})).toThrow(/CONTACT_EMAIL/);
    const config = loadEGramSwarajConfig({ ETL_EGS_CONTACT_EMAIL: 'lead@example.org' });
    expect(config.minIntervalMs).toBe(6000);
    expect(config.userAgent).toContain('mailto:lead@example.org');
  });
});

describe('HTML helpers', () => {
  it('classifies report pages by title', () => {
    expect(detectLevel(fixture('gp-monthly-statement.html'))).toBe('monthly');
    expect(detectLevel(fixture('block-report.html'))).toBe('village');
    expect(detectLevel(fixture('district-report.html'))).toBe('block');
    expect(detectLevel(fixture('state-report.html'))).toBe('district');
    expect(detectLevel('<html></html>')).toBe('unknown');
  });

  it('classifies scheme-wise report pages by level', () => {
    expect(detectLevel(fixture('scheme-state.html'))).toBe('scheme_state');
    expect(detectLevel(fixture('scheme-district.html'))).toBe('scheme_district');
    expect(detectLevel(fixture('scheme-block.html'))).toBe('scheme_block');
    expect(detectLevel(fixture('scheme-village.html'))).toBe('scheme_village');
  });

  it('parses fiscal-year month labels including typos', () => {
    expect(monthFromLabel('April, 2025')).toBe(1);
    expect(monthFromLabel('Januaury, 2026')).toBe(10);
    expect(monthFromLabel('March, 2026')).toBe(12);
    expect(monthFromLabel('Opening Balance')).toBeUndefined();
  });

  it('parses Indian-format money and financial years', () => {
    expect(parseMoney('27,37,064.11')).toBe(2737064.11);
    expect(parseMoney('0.00')).toBe(0);
    expect(parseFinancialYear('Financial Year:-2025-2026 State:-Maharashtra')).toBe(2025);
  });
});

describe('eGramSwaraj parser', () => {
  it('parses a GP monthly statement into opening, months, and total', () => {
    const result = parseReport(envelope(fixture('gp-monthly-statement.html')));
    expect(result.diagnostics[0]?.warnings).toEqual([]);
    expect(result.records).toHaveLength(14);

    const opening = result.records.find((r) => r.period === 'opening_balance');
    expect(opening).toMatchObject({
      kind: 'monthly_statement',
      source: SOURCE_MONTHLY,
      financialYear: 2025,
      openingBalance: 2737064.11,
      stateName: 'Maharashtra',
      districtName: 'Ahilyanagar',
      blockName: 'Akole',
      panchayatName: 'Ambitkhind',
    });

    const march = result.records.find((r) => r.period === 'March 2026');
    expect(march?.monthNo).toBe(12);
    expect(march?.payments).toBe(376095);

    const total = result.records.find((r) => r.period === 'total');
    expect(total?.receipts).toBe(1405947);
    expect(total?.payments).toBe(1028198.9);
  });

  it('parses a block village-wise statement into one record per GP', () => {
    const result = parseReport(envelope(fixture('block-report.html')));
    expect(result.records).toHaveLength(147);
    const first = result.records[0];
    expect(first).toMatchObject({
      kind: 'village_statement',
      source: SOURCE_VILLAGE,
      period: 'total',
      panchayatName: 'Ambad',
      districtName: 'Ahilyanagar',
      blockName: 'Akole',
      receipts: 5858753.21,
      payments: 2496078,
    });
    expect(result.records.some((r) => r.panchayatName === 'Total')).toBe(false);
  });

  it('skips state and district aggregate reports', () => {
    expect(parseReport(envelope(fixture('state-report.html'))).records).toHaveLength(0);
    expect(parseReport(envelope(fixture('district-report.html'))).records).toHaveLength(0);
  });

  it('parses a scheme village statement into one record per GP', () => {
    const result = parseReport(envelope(fixture('scheme-village.html')));
    expect(result.diagnostics[0]?.warnings).toEqual([]);
    expect(result.records).toHaveLength(147);
    const first = result.records[0];
    expect(first).toMatchObject({
      kind: 'scheme_village',
      source: SOURCE_SCHEME,
      financialYear: 2025,
      period: 'total',
      scheme: 'XV Finance Commission--XVFC',
      stateName: 'Maharashtra',
      districtName: 'Ahilyanagar',
      blockName: 'Akole',
      panchayatName: 'Ambad',
      receipts: 3542718.92,
      payments: 1054083,
    });
    expect(result.records.some((r) => r.panchayatName === 'Total')).toBe(false);
    expect(result.records.some((r) => r.panchayatName === 'Ambitkhind')).toBe(true);
  });

  it('skips scheme aggregate reports below village level', () => {
    for (const name of ['scheme-state.html', 'scheme-district.html', 'scheme-block.html']) {
      const result = parseReport(envelope(fixture(name)));
      expect(result.records).toHaveLength(0);
      expect(result.diagnostics[0]?.kind).toBe('skipped');
      expect(result.diagnostics[0]?.warnings).toContain(
        'scheme aggregate report is not panchayat-level; skipped',
      );
    }
  });

  it('reports drift when the financial year disappears', () => {
    const result = parseReport(
      envelope('<html><body><table><tr><td>unexpected</td></tr></table></body></html>'),
    );
    expect(result.records).toHaveLength(0);
    expect(result.diagnostics[0]?.warnings).toContain('financial year not found');
  });
});

describe('eGramSwaraj stages', () => {
  it('validates a monthly record and rejects negative values', async () => {
    const [record] = parseReport(envelope(fixture('gp-monthly-statement.html'))).records;
    const outcome = await validate([{ ...record!, payments: -1 }], testCtx('validate'));
    expect(outcome.valid).toHaveLength(0);
    expect(outcome.invalid[0]?.errors).toContain('payments must be non-negative');
  });

  it('requires panchayat identity before loading', async () => {
    const [record] = parseReport(envelope(fixture('gp-monthly-statement.html'))).records;
    const outcome = await validate([{ ...record!, panchayatName: undefined }], testCtx('validate'));
    expect(outcome.invalid[0]?.errors).toContain('panchayatName is required');
  });

  it('deduplicates on the natural key', async () => {
    const record = parseReport(envelope(fixture('gp-monthly-statement.html'))).records[0]!;
    const { kept, removed } = await deduplicate([record, { ...record }], testCtx('deduplicate'));
    expect(kept).toHaveLength(1);
    expect(removed).toHaveLength(1);
  });

  it('validates scheme records and rejects missing scheme/panchayat', async () => {
    const [record] = parseReport(envelope(fixture('scheme-village.html'))).records;
    const ok = await validate([record!], testCtx('validate'));
    expect(ok.valid).toHaveLength(1);

    const bad = await validate([{ ...record!, scheme: undefined }], testCtx('validate'));
    expect(bad.invalid[0]?.errors).toContain('scheme is required');

    const anonymous = await validate(
      [{ ...record!, panchayatName: undefined }],
      testCtx('validate'),
    );
    expect(anonymous.invalid[0]?.errors).toContain('panchayatName is required');
  });

  it('normalizes scheme names', async () => {
    const record = {
      ...parseReport(envelope(fixture('scheme-village.html'))).records[0]!,
      scheme: '  XV Finance Commission--XVFC  ',
    };
    const [normalized] = await normalize([record], testCtx('normalize'));
    expect(normalized?.scheme).toBe('XV Finance Commission--XVFC');
  });

  it('normalizes names and money precision', async () => {
    const record = {
      ...parseReport(envelope(fixture('gp-monthly-statement.html'))).records[0]!,
      panchayatName: ' Ambitkhind  ',
      receipts: 1.056,
    };
    const [normalized] = await normalize([record], testCtx('normalize'));
    expect(normalized?.panchayatName).toBe('Ambitkhind');
    expect(normalized?.receipts).toBe(1.06);
  });

  it('transform resolves identities and drops unresolved records', async () => {
    const record = parseReport(envelope(fixture('gp-monthly-statement.html'))).records[0]!;
    const resolve: IdentityResolver = {
      resolve: async (r) =>
        r.panchayatName === 'Ambitkhind'
          ? { districtId: 1, talukaId: 2, panchayatId: 3 }
          : undefined,
    };
    const transform = createResolvingTransform(resolve);
    const kept = await transform(
      [record, { ...record, panchayatName: 'Nowhere' }],
      testCtx('transform'),
    );
    expect(kept).toHaveLength(1);
    expect(kept[0]).toMatchObject({ panchayatId: 3, districtId: 1, talukaId: 2 });
  });
});

describe('identity resolver (fake pool)', () => {
  it('resolves district/block/panchayat names to ids', async () => {
    const queries: unknown[][] = [];
    const pool = {
      query: async (_sql: string, params: unknown[]) => {
        queries.push(params);
        return {
          rows: [{ district_id: '11', taluka_id: '22', panchayat_id: '33' }],
          rowCount: 1,
        };
      },
    } as never;
    const resolver = createIdentityResolver(pool);
    await expect(
      resolver.resolve({
        stateName: 'Maharashtra',
        districtName: 'Ahilyanagar',
        blockName: 'Akole',
        panchayatName: 'Ambitkhind',
      }),
    ).resolves.toEqual({ districtId: 11, talukaId: 22, panchayatId: 33 });
    expect(queries).toHaveLength(1);
    expect(queries[0]).toEqual(['Ahilyanagar', 'Akole', 'Ambitkhind']);
  });

  it('returns undefined when nothing matches and caches misses', async () => {
    let calls = 0;
    const pool = {
      query: async () => {
        calls++;
        return { rows: [], rowCount: 0 };
      },
    } as never;
    const resolver = createIdentityResolver(pool);
    const record = { stateName: 'Maharashtra', districtName: 'Nowhere', panchayatName: 'X' };
    await expect(resolver.resolve(record)).resolves.toBeUndefined();
    await expect(resolver.resolve(record)).resolves.toBeUndefined();
    expect(calls).toBe(1);
  });
});

describe('eGramSwaraj crawler', () => {
  it('walks block → GP pages and stops at maxPages', async () => {
    const calls: string[] = [];
    const fetchFn: typeof fetch = async (input, init) => {
      const url = String(input);
      calls.push(url);
      expect(new Headers(init?.headers).get('user-agent')).toContain('mailto:test@example.org');
      const body = url.includes('ExpFY')
        ? fixture('gp-monthly-statement.html')
        : fixture('block-report.html');
      return new Response(body, { status: 200, headers: { 'content-type': 'text/html' } });
    };
    const result = await createEGramSwarajFetcher(
      sourceConfig({
        reportUrls: ['FileRedirect.jsp?FD=ExpenditureReport2025-2026/27/424&name=4635.html'],
        maxPages: 3,
      }),
      { fetchFn, sleep: async () => {} },
    )(testCtx('fetch'));

    const pages = JSON.parse(result.content) as { url: string }[];
    expect(calls).toHaveLength(3);
    expect(pages).toHaveLength(3);
    expect(pages[0]?.url).toContain('name=4635.html');
    expect(pages[1]?.url).toContain('ExpFY');
    expect(pages[2]?.url).toContain('ExpFY');
  });

  it('skips non-retryable page failures and reports them as warnings', async () => {
    const fetchFn: typeof fetch = async (input) => {
      const url = String(input);
      if (url.includes('ExpFY')) return new Response('nope', { status: 404 });
      return new Response(
        '<html><table><tr><td>Village wise Receipt and Payment Statement Financial Year:-2025-2026 State:-Maharashtra,District:-A,Block:-B</td></tr>' +
          '<tr><td>Village Panchayat & Equivalent</td><td>Receipts</td><td>Payments</td></tr>' +
          '<tr><td><a href="FileRedirect.jsp?FD=ExpFY2025-2026/27&name=1.html">Ambad</a></td><td>10</td><td>20</td></tr>' +
          '</table></html>',
        { status: 200 },
      );
    };
    const result = await createEGramSwarajFetcher(
      sourceConfig({ reportUrls: ['x.html'], maxPages: 2 }),
      { fetchFn, sleep: async () => {} },
    )(testCtx('fetch'));

    const pages = JSON.parse(result.content) as { url: string }[];
    expect(pages).toHaveLength(1);
    expect((result.meta.warnings as string[])[0]).toContain('HTTP 404');
  });

  it('skips sessexpire missing-file pages and reports them as warnings', async () => {
    const fetchFn: typeof fetch = async () =>
      new Response(
        '<HTML><HEAD><script src="https://bhashiniwebtransstorage.blob.core.windows.net/static/js/script.js"></script>' +
          '</HEAD><BODY><script>alert("File does not exist");</script></BODY></HTML>',
        { status: 200 },
      );
    const result = await createEGramSwarajFetcher(
      sourceConfig({ reportUrls: ['x.html'], maxPages: 2 }),
      { fetchFn, sleep: async () => {} },
    )(testCtx('fetch'));

    const pages = JSON.parse(result.content) as { url: string }[];
    expect(pages).toHaveLength(0);
    expect((result.meta.warnings as string[])[0]).toContain('missing report file');
  });

  it('propagates retryable failures so the pipeline can retry', async () => {
    const fetchFn: typeof fetch = async () => {
      throw new Error('socket hang up');
    };
    await expect(
      createEGramSwarajFetcher(sourceConfig(), { fetchFn, sleep: async () => {} })(
        testCtx('fetch'),
      ),
    ).rejects.toMatchObject({ retryable: true });
  });

  it('retries a flaky page with backoff before giving up on it', async () => {
    let calls = 0;
    const fetchFn: typeof fetch = async () => {
      calls++;
      if (calls === 1) throw new Error('socket hang up');
      return new Response(
        '<html><table><tr><td>Village wise Receipt and Payment Statement Financial Year:-2025-2026 State:-Maharashtra,District:-A,Block:-B</td></tr></table></html>',
        { status: 200 },
      );
    };
    const result = await createEGramSwarajFetcher(
      sourceConfig({ reportUrls: ['x.html'], maxPages: 1 }),
      { fetchFn, sleep: async () => {} },
    )(testCtx('fetch'));

    const pages = JSON.parse(result.content) as { url: string }[];
    expect(calls).toBe(2);
    expect(pages).toHaveLength(1);
    expect(result.meta.warnings).toHaveLength(0);
  });

  it('skips a persistently failing page mid-crawl and keeps going', async () => {
    const fetchFn: typeof fetch = async (input) => {
      const url = String(input);
      if (url.includes('name=bad.html')) throw new Error('ECONNRESET');
      return new Response(
        '<html><table><tr><td>Village wise Receipt and Payment Statement Financial Year:-2025-2026 State:-Maharashtra,District:-A,Block:-B</td></tr>' +
          '<tr><td>Village Panchayat & Equivalent</td><td>Receipts</td><td>Payments</td></tr>' +
          '<tr><td><a href="FileRedirect.jsp?FD=ExpFY2025-2026/27&name=1.html">Ambad</a></td><td>10</td><td>20</td></tr>' +
          '<tr><td><a href="FileRedirect.jsp?FD=ExpFY2025-2026/27&name=bad.html">Flaky</a></td><td>1</td><td>2</td></tr>' +
          '</table></html>',
        { status: 200 },
      );
    };
    const result = await createEGramSwarajFetcher(
      sourceConfig({ reportUrls: ['x.html'], maxPages: 3 }),
      { fetchFn, sleep: async () => {} },
    )(testCtx('fetch'));

    const pages = JSON.parse(result.content) as { url: string }[];
    expect(pages).toHaveLength(2);
    expect(pages.map((p) => p.url)).not.toContain('bad.html');
    expect((result.meta.warnings as string[]).join()).toContain('bad.html');
    expect(result.meta.warnings as string[]).toHaveLength(1);
  });
});

describe('pipeline', () => {
  it('runs end-to-end: resolves, dedupes, and upserts financial statements', async () => {
    const fetchFn: typeof fetch = async () =>
      new Response(fixture('gp-monthly-statement.html'), { status: 200 });

    const queries: { sql: string; params: unknown[] }[] = [];
    const pool = {
      query: async (sql: string, params: unknown[]) => {
        queries.push({ sql, params });
        return { rows: [], rowCount: sql.includes('INSERT') ? params.length / 11 : 0 };
      },
    } as never;

    const resolve: IdentityResolver = {
      resolve: async () => ({ districtId: 1, talukaId: 2, panchayatId: 3 }),
    };
    const deadLetter = memoryDeadLetter();
    const audit = memoryAudit();
    const pipeline = buildEGramSwarajPipeline({
      sourceConfig: sourceConfig({ reportUrls: ['gp.html'], maxPages: 1 }),
      pool,
      resolve,
      fetch: { fetchFn, sleep: async () => {} },
      pipeline: {
        config: testConfig({ batchSize: 100 }),
        deadLetter: deadLetter.sink,
        audit: audit.sink,
      },
    });

    const report = await pipeline.run();

    expect(report.status).toBe('success');
    expect(report.counts).toMatchObject({
      rowsSeen: 14,
      rowsUpserted: 14,
      duplicatesRemoved: 0,
      validationFailures: 0,
    });

    const loadQuery = queries.find((q) => q.sql.includes('INSERT INTO financial_statements'));
    expect(loadQuery).toBeDefined();
    expect(loadQuery!.sql).toContain('ON CONFLICT (panchayat_id, fy, period, source) DO UPDATE');
    expect(loadQuery!.params).toHaveLength(14 * 11);
    expect(loadQuery!.params.slice(0, 11)).toEqual([
      3,
      2025,
      'opening_balance',
      null,
      0,
      0,
      0,
      0,
      0,
      2737064.11,
      SOURCE_MONTHLY,
    ]);
    expect(deadLetter.items).toHaveLength(0);
    expect(audit.runs[0]?.source).toBe('egramswaraj');
  });

  it('drops unresolved panchayats without aborting the run', async () => {
    const fetchFn: typeof fetch = async () =>
      new Response(fixture('gp-monthly-statement.html'), { status: 200 });
    const pool = {
      query: async () => ({ rows: [], rowCount: 0 }),
    } as never;
    const resolve: IdentityResolver = { resolve: async () => undefined };
    const deadLetter = memoryDeadLetter();
    const pipeline = buildEGramSwarajPipeline({
      sourceConfig: sourceConfig({ reportUrls: ['gp.html'], maxPages: 1 }),
      pool,
      resolve,
      fetch: { fetchFn, sleep: async () => {} },
      pipeline: { config: testConfig(), deadLetter: deadLetter.sink },
    });

    const report = await pipeline.run();
    expect(report.status).toBe('success');
    expect(report.counts.rowsSeen).toBe(14);
    expect(report.counts.rowsUpserted).toBe(0);
    expect(report.counts.rowsSkipped).toBe(14);
  });

  it('upserts scheme expenditures into their own table', async () => {
    const fetchFn: typeof fetch = async () =>
      new Response(fixture('scheme-village.html'), { status: 200 });

    const queries: { sql: string; params: unknown[] }[] = [];
    const pool = {
      query: async (sql: string, params: unknown[]) => {
        queries.push({ sql, params });
        const columns = sql.includes('INSERT INTO scheme_expenditures') ? 8 : 11;
        return { rows: [], rowCount: sql.includes('INSERT') ? params.length / columns : 0 };
      },
    } as never;

    const resolve: IdentityResolver = {
      resolve: async () => ({ districtId: 1, talukaId: 2, panchayatId: 3 }),
    };
    const deadLetter = memoryDeadLetter();
    const pipeline = buildEGramSwarajPipeline({
      sourceConfig: sourceConfig({ reportUrls: ['scheme.html'], maxPages: 1 }),
      pool,
      resolve,
      fetch: { fetchFn, sleep: async () => {} },
      pipeline: { config: testConfig({ batchSize: 100 }), deadLetter: deadLetter.sink },
    });

    const report = await pipeline.run();
    expect(report.status).toBe('success');
    expect(report.counts).toMatchObject({ rowsSeen: 147, rowsUpserted: 147 });

    const loadQueries = queries.filter((q) => q.sql.includes('INSERT INTO scheme_expenditures'));
    expect(loadQueries).not.toHaveLength(0);
    expect(loadQueries[0]!.sql).toContain(
      'ON CONFLICT (panchayat_id, fy, scheme, source) DO UPDATE',
    );
    expect(loadQueries.reduce((sum, q) => sum + q.params.length, 0)).toBe(147 * 8);
    expect(loadQueries[0]!.params.slice(0, 8)).toEqual([
      3,
      2025,
      'XV Finance Commission--XVFC',
      3542718.92,
      1054083,
      SOURCE_SCHEME,
      'https://egramswaraj.gov.in/scheme.html',
      'https://egramswaraj.gov.in/scheme.html#2',
    ]);
    expect(queries.some((q) => q.sql.includes('INSERT INTO financial_statements'))).toBe(false);
    expect(deadLetter.items).toHaveLength(0);
  });
});
