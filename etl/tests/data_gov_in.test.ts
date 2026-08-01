import { describe, expect, it } from 'vitest';
import { ETLError } from '../src/core/errors.js';
import { loadConfig } from '../src/core/config.js';
import { createDistrictResolver } from '../sources/data_gov_in/resolver.js';
import { buildDataGovInPipeline } from '../sources/data_gov_in/index.js';
import {
  buildResourceUrl,
  createFetcher,
  fetchDataGovInPage,
} from '../sources/data_gov_in/client.js';
import {
  parseArrivalDate,
  parseContent,
  normalize,
  deduplicate,
  naturalKey,
} from '../sources/data_gov_in/mapping.js';
import { createValidator } from '../sources/data_gov_in/validate.js';
import { loadDataGovInConfig } from '../sources/data_gov_in/config.js';
import type {
  DataGovInConfig,
  DistrictResolver,
  MandiPriceRecord,
} from '../sources/data_gov_in/types.js';
import { memoryAudit, memoryDeadLetter, testConfig, testCtx } from './helpers.js';

function sourceConfig(overrides: Partial<DataGovInConfig> = {}): DataGovInConfig {
  return {
    apiKey: 'test-key',
    resourceId: '9ef84268-d588-465a-a308-a864a43d0070',
    state: 'Maharashtra',
    baseUrl: 'https://api.example.in/resource',
    pageSize: 2,
    maxPages: 5,
    ...overrides,
  };
}

function rawRecord(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    state: 'Maharashtra',
    district: 'Pune',
    market: 'Pune APMC',
    commodity: 'Onion',
    variety: 'Red',
    grade: 'FAQ',
    arrival_date: '01/08/2026',
    min_price: 1200,
    max_price: 1500,
    modal_price: 1400,
    ...overrides,
  };
}

function mappedRecord(overrides: Partial<MandiPriceRecord> = {}): MandiPriceRecord {
  return {
    state: 'Maharashtra',
    district: 'Pune',
    market: 'Pune APMC',
    commodity: 'Onion',
    variety: 'Red',
    grade: 'FAQ',
    priceDate: '2026-08-01',
    minPrice: 1200,
    maxPrice: 1500,
    modalPrice: 1400,
    ...overrides,
  };
}

const puneLgd: DistrictResolver = async () => new Map([['pune', 511]]);

describe('config', () => {
  it('requires an API key', () => {
    expect(() => loadDataGovInConfig({})).toThrow(ETLError);
    expect(() => loadDataGovInConfig({})).toThrow(/ETL_DGI_API_KEY/);
  });

  it('reads optional vars and defaults the resource id', () => {
    const config = loadDataGovInConfig({
      ETL_DGI_API_KEY: 'k',
      ETL_DGI_STATE: ' Maharashtra ',
    });
    expect(config.apiKey).toBe('k');
    expect(config.resourceId).toBe('9ef84268-d588-465a-a308-a864a43d0070');
    expect(config.state).toBe('Maharashtra');
    expect(config.pageSize).toBe(1000);
    expect(config.maxPages).toBe(20);
  });
});

describe('client', () => {
  it('builds a filtered, paginated resource URL', () => {
    const url = buildResourceUrl(sourceConfig(), 10);
    expect(url).toContain('/resource/9ef84268-d588-465a-a308-a864a43d0070?');
    expect(url).toContain('api-key=test-key');
    expect(url).toContain('format=json');
    expect(url).toContain('limit=2');
    expect(url).toContain('offset=10');
    expect(url).toContain('filters%5Bstate%5D=Maharashtra');
  });

  it('parses a well-formed page envelope', async () => {
    const fetchFn = async () =>
      new Response(JSON.stringify({ status: 'ok', total: 1, count: 1, records: [rawRecord()] }), {
        status: 200,
      });
    const page = await fetchDataGovInPage(sourceConfig(), 0, fetchFn);
    expect(page.total).toBe(1);
    expect(page.records[0]?.commodity).toBe('Onion');
  });

  it('treats non-2xx responses as retryable', async () => {
    const fetchFn = async () => new Response('boom', { status: 502 });
    await expect(fetchDataGovInPage(sourceConfig(), 0, fetchFn)).rejects.toMatchObject({
      retryable: true,
    });
  });

  it('treats an unexpected envelope as non-retryable', async () => {
    const fetchFn = async () => new Response(JSON.stringify({ status: 'error' }), { status: 200 });
    await expect(fetchDataGovInPage(sourceConfig(), 0, fetchFn)).rejects.toMatchObject({
      retryable: false,
    });
  });

  it('walks pages and reports totals', async () => {
    const pages = [
      { status: 'ok', total: 3, count: 2, records: [rawRecord(), rawRecord({ market: 'A' })] },
      { status: 'ok', total: 3, count: 1, records: [rawRecord({ market: 'B' })] },
    ];
    let call = 0;
    const fetchFn = async () => new Response(JSON.stringify(pages[call++]!), { status: 200 });

    const result = await createFetcher(sourceConfig(), fetchFn)(testCtx());
    const body = JSON.parse(result.content) as { records: unknown[]; total: number };
    expect(call).toBe(2);
    expect(body.records).toHaveLength(3);
    expect(body.total).toBe(3);
    expect(result.meta.pages).toBe(2);
    expect(result.meta.truncated).toBe(false);
  });

  it('stops at maxPages and flags truncation', async () => {
    const fetchFn = async () =>
      new Response(
        JSON.stringify({ status: 'ok', total: 100, count: 2, records: [rawRecord(), rawRecord()] }),
        { status: 200 },
      );
    const result = await createFetcher(sourceConfig({ maxPages: 2 }), fetchFn)(testCtx());
    expect(result.meta.pages).toBe(2);
    expect(result.meta.truncated).toBe(true);
  });
});

describe('mapping', () => {
  it('converts DD/MM/YYYY to ISO and rejects rollover dates', () => {
    expect(parseArrivalDate('01/08/2026')).toBe('2026-08-01');
    expect(parseArrivalDate('1/8/2026')).toBe('2026-08-01');
    expect(parseArrivalDate('31/02/2026')).toBeNull();
    expect(parseArrivalDate('2026-08-01')).toBeNull();
    expect(parseArrivalDate('')).toBeNull();
  });

  it('maps raw records onto the internal shape', async () => {
    const records = await parseContent(
      { content: JSON.stringify({ records: [rawRecord()] }), meta: { fetchedAt: 'x' } },
      testCtx(),
    );
    expect(records).toHaveLength(1);
    expect(records[0]!).toMatchObject({
      state: 'Maharashtra',
      market: 'Pune APMC',
      priceDate: '2026-08-01',
      minPrice: 1200,
      maxPrice: 1500,
      modalPrice: 1400,
      grade: 'FAQ',
    });
    expect(records[0]!.districtLgdCode).toBeUndefined();
  });

  it('throws on missing records array', async () => {
    await expect(
      parseContent({ content: '{}', meta: { fetchedAt: 'x' } }, testCtx()),
    ).rejects.toThrow(/missing the records array/);
  });

  it('collapses whitespace and clamps negative prices in normalize', async () => {
    const records = await normalize(
      [mappedRecord({ market: 'Pune   APMC', minPrice: -5 })],
      testCtx(),
    );
    expect(records[0]!.market).toBe('Pune APMC');
    expect(records[0]!.minPrice).toBe(0);
  });

  it('deduplicates on the natural key including district', async () => {
    const a = mappedRecord({ districtLgdCode: 511 });
    const { kept, removed } = await deduplicate([a, { ...a, priceDate: '2026-08-02' }, a]);
    expect(kept).toHaveLength(2);
    expect(removed).toHaveLength(1);
    expect(naturalKey(a)).toContain('511');
  });
});

describe('validate', () => {
  it('rejects malformed records and resolves district codes', async () => {
    const validate = createValidator(puneLgd);
    const outcome = await validate(
      [
        { ...mappedRecord(), priceDate: '' },
        { ...mappedRecord(), district: 'Nowhere' },
        { ...mappedRecord(), maxPrice: 500 },
        mappedRecord(),
      ],
      testCtx(),
    );

    expect(outcome.valid).toHaveLength(1);
    expect(outcome.valid[0]!.districtLgdCode).toBe(511);
    expect(outcome.invalid.map((r) => r.errors)).toEqual([
      ['arrival_date must be a valid DD/MM/YYYY date'],
      ['max_price must be >= min_price'],
      ["district 'Nowhere' not found in hierarchy"],
    ]);
  });

  it('rejects future arrival dates', async () => {
    const validate = createValidator(puneLgd);
    const outcome = await validate([{ ...mappedRecord(), priceDate: '2099-01-01' }], testCtx());
    expect(outcome.invalid[0]?.errors).toEqual(["arrival date '2099-01-01' is in the future"]);
  });

  it('resolves districts with one batched query', async () => {
    let calls = 0;
    const resolver: DistrictResolver = async (names) => {
      calls++;
      expect([...names].sort()).toEqual(['Pune', 'Satara']);
      return new Map([
        ['pune', 511],
        ['satara', 512],
      ]);
    };
    const validate = createValidator(resolver);
    await validate(
      [mappedRecord(), mappedRecord({ district: 'Satara', market: 'Satara APMC' })],
      testCtx(),
    );
    expect(calls).toBe(1);
  });
});

describe('district resolver (fake pool)', () => {
  it('matches name_en case-insensitively', async () => {
    const pool = {
      query: async () => ({
        rows: [{ lgd_code: '511', name_en: 'Pune' }],
        rowCount: 1,
      }),
    } as never;
    const resolver = createDistrictResolver(pool);
    const map = await resolver(['pune', 'PUNE', 'nope']);
    expect(map.get('pune')).toBe(511);
    expect(map.has('nope')).toBe(false);
  });
});

describe('pipeline', () => {
  it('runs end-to-end: dead-letters invalid, dedupes, upserts', async () => {
    const payloads = [
      { status: 'ok', total: 2, count: 2, records: [rawRecord(), rawRecord()] },
      { status: 'ok', total: 2, count: 0, records: [] },
    ];
    let call = 0;
    const fetchFn = async () => new Response(JSON.stringify(payloads[call++]!), { status: 200 });

    const queries: { sql: string; params: unknown[] }[] = [];
    const pool = {
      query: async (sql: string, params: unknown[]) => {
        queries.push({ sql, params });
        return { rows: [], rowCount: sql.includes('INSERT') ? 1 : 0 };
      },
    } as never;

    const deadLetter = memoryDeadLetter();
    const audit = memoryAudit();
    const pipeline = buildDataGovInPipeline({
      sourceConfig: sourceConfig({ pageSize: 2 }),
      pool,
      resolveDistricts: puneLgd,
      fetchFn,
      pipeline: {
        config: testConfig({ batchSize: 2 }),
        deadLetter: deadLetter.sink,
        audit: audit.sink,
      },
    });

    const report = await pipeline.run();

    expect(report.status).toBe('success');
    expect(report.counts).toMatchObject({
      rowsSeen: 2,
      rowsUpserted: 1,
      duplicatesRemoved: 1,
      validationFailures: 0,
    });

    const loadQuery = queries.find((q) => q.sql.includes('INSERT INTO commodity_prices'));
    expect(loadQuery).toBeDefined();
    expect(loadQuery!.sql).toContain(
      'ON CONFLICT (district_lgd_code, market, commodity, variety, grade, price_date) DO UPDATE',
    );
    expect(loadQuery!.params).toEqual([
      511,
      'Pune APMC',
      'Onion',
      'Red',
      'FAQ',
      1200,
      1500,
      1400,
      '2026-08-01',
    ]);

    expect(deadLetter.items).toHaveLength(0);
    expect(audit.runs[0]?.source).toBe('data_gov_in');
  });

  it('dead-letters invalid and unknown-district records without aborting', async () => {
    const payload = {
      status: 'ok',
      total: 3,
      count: 3,
      records: [rawRecord(), rawRecord({ district: 'Nowhere' }), rawRecord({ max_price: 100 })],
    };
    const fetchFn = async () => new Response(JSON.stringify(payload), { status: 200 });
    const pool = {
      query: async () => ({ rows: [], rowCount: 1 }),
    } as never;

    const deadLetter = memoryDeadLetter();
    const pipeline = buildDataGovInPipeline({
      sourceConfig: sourceConfig({ pageSize: 3 }),
      pool,
      resolveDistricts: puneLgd,
      fetchFn,
      pipeline: {
        config: testConfig({ batchSize: 10 }),
        deadLetter: deadLetter.sink,
      },
    });

    const report = await pipeline.run();
    expect(report.status).toBe('success');
    expect(report.counts).toMatchObject({
      rowsSeen: 3,
      rowsUpserted: 1,
      validationFailures: 2,
      rowsFailed: 2,
    });

    expect(deadLetter.items).toHaveLength(1);
    expect(deadLetter.items[0]?.stage).toBe('validate');
    expect(deadLetter.items[0]?.records).toHaveLength(2);
  });
});

describe('runDataGovIn config wiring', () => {
  it('loads core config', () => {
    const config = loadConfig({ ETL_ENV: 'test' });
    expect(config.env).toBe('test');
  });
});
