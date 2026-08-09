import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ETLError } from '../src/core/errors.js';
import { buildLgdPipeline } from '../sources/lgd/index.js';
import { buildSearchUrl, createFetcher, fetchLgdPage } from '../sources/lgd/client.js';
import {
  parseContent,
  normalize,
  deduplicate,
  naturalKey,
  parseLgdCode,
} from '../sources/lgd/mapping.js';
import { createValidator } from '../sources/lgd/validate.js';
import { loadLgdConfig } from '../sources/lgd/config.js';
import { createHierarchyLoader } from '../sources/lgd/loader.js';
import type { LgdConfig, LgdRow } from '../sources/lgd/types.js';
import { memoryAudit, memoryDeadLetter, testConfig, testCtx } from './helpers.js';

function sourceConfig(overrides: Partial<LgdConfig> = {}): LgdConfig {
  return {
    baseUrl: 'https://ckandev.example.in/api/3/action/datastore_search',
    resourceId: 'cb81a7a4-a3bc-4962-a1eb-838a1db5bfdb',
    pageSize: 2,
    maxPages: 5,
    ...overrides,
  };
}

function rawRecord(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    village_name: 'Galotha Bk',
    village_code: '525175',
    local_body_name: 'GHATANI',
    local_body_type: 'Village Panchayat',
    local_body_code: '182109',
    sub_district_name: 'Akkalkuwa',
    sub_district_code: '3950',
    district_name: 'NANDURBAR',
    district_code: '486',
    state_name: 'MAHARASHTRA',
    state_code: '27',
    ...overrides,
  };
}

function mappedRecord(overrides: Partial<LgdRow> = {}): LgdRow {
  return {
    stateCode: 27,
    stateName: 'MAHARASHTRA',
    districtCode: 486,
    districtName: 'NANDURBAR',
    talukCode: 3950,
    talukName: 'Akkalkuwa',
    panchayatCode: 182109,
    panchayatName: 'GHATANI',
    panchayatLevel: 'gram',
    villageCode: 525175,
    villageName: 'Galotha Bk',
    ...overrides,
  };
}

describe('config', () => {
  it('requires a resource id', () => {
    expect(() => loadLgdConfig({})).toThrow(ETLError);
    expect(() => loadLgdConfig({})).toThrow(/ETL_LGD_RESOURCE_ID/);
  });

  it('reads optional vars and defaults', () => {
    const config = loadLgdConfig({ ETL_LGD_RESOURCE_ID: 'res-1' });
    expect(config.resourceId).toBe('res-1');
    expect(config.pageSize).toBe(1000);
    expect(config.maxPages).toBe(20);
    expect(config.baseUrl).toContain('datastore_search');
  });
});

describe('client', () => {
  it('builds a paginated datastore URL', () => {
    const url = buildSearchUrl(sourceConfig(), 10);
    expect(url).toContain('datastore_search?');
    expect(url).toContain('resource_id=cb81a7a4-a3bc-4962-a1eb-838a1db5bfdb');
    expect(url).toContain('limit=2');
    expect(url).toContain('offset=10');
  });

  it('parses a well-formed page envelope', async () => {
    const fetchFn = async () =>
      new Response(
        JSON.stringify({ success: true, result: { total: 1, records: [rawRecord()] } }),
        {
          status: 200,
        },
      );
    const page = await fetchLgdPage(sourceConfig(), 0, fetchFn);
    expect(page.total).toBe(1);
    expect(page.records[0]?.village_name).toBe('Galotha Bk');
  });

  it('treats non-2xx responses as retryable', async () => {
    const fetchFn = async () => new Response('boom', { status: 502 });
    await expect(fetchLgdPage(sourceConfig(), 0, fetchFn)).rejects.toMatchObject({
      retryable: true,
    });
  });

  it('treats an unexpected envelope as non-retryable', async () => {
    const fetchFn = async () => new Response(JSON.stringify({ success: false }), { status: 200 });
    await expect(fetchLgdPage(sourceConfig(), 0, fetchFn)).rejects.toMatchObject({
      retryable: false,
    });
  });

  it('walks pages and reports totals', async () => {
    const pages = [
      {
        success: true,
        result: { total: 3, records: [rawRecord(), rawRecord({ village_name: 'A' })] },
      },
      { success: true, result: { total: 3, records: [rawRecord({ village_name: 'B' })] } },
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
        JSON.stringify({
          success: true,
          result: { total: 100, records: [rawRecord(), rawRecord()] },
        }),
        { status: 200 },
      );
    const result = await createFetcher(sourceConfig({ maxPages: 2 }), fetchFn)(testCtx());
    expect(result.meta.pages).toBe(2);
    expect(result.meta.truncated).toBe(true);
  });
});

describe('mapping', () => {
  it('parses codes: zero-padded, numbers, and the None sentinel', () => {
    expect(parseLgdCode('000052')).toBe(52);
    expect(parseLgdCode(3950)).toBe(3950);
    expect(parseLgdCode('None')).toBeNull();
    expect(parseLgdCode(null)).toBeNull();
    expect(parseLgdCode('')).toBeNull();
  });

  it('maps raw records onto the internal shape', async () => {
    const records = await parseContent(
      { content: JSON.stringify({ records: [rawRecord()] }), meta: { fetchedAt: 'x' } },
      testCtx(),
    );
    expect(records).toHaveLength(1);
    expect(records[0]!).toMatchObject({
      stateCode: 27,
      stateName: 'MAHARASHTRA',
      districtCode: 486,
      districtName: 'NANDURBAR',
      talukCode: 3950,
      talukName: 'Akkalkuwa',
      panchayatCode: 182109,
      panchayatName: 'GHATANI',
      panchayatLevel: 'gram',
      villageCode: 525175,
      villageName: 'Galotha Bk',
    });
  });

  it('leaves unmapped villages with a null panchayat', async () => {
    const records = await parseContent(
      {
        content: JSON.stringify({
          records: [rawRecord({ local_body_name: null, local_body_code: 'None' })],
        }),
        meta: { fetchedAt: 'x' },
      },
      testCtx(),
    );
    expect(records[0]!.panchayatCode).toBeNull();
    expect(records[0]!.panchayatName).toBeNull();
    expect(records[0]!.panchayatLevel).toBe('gram');
  });

  it('throws on missing records array', async () => {
    await expect(
      parseContent({ content: '{}', meta: { fetchedAt: 'x' } }, testCtx()),
    ).rejects.toThrow(/missing the records array/);
  });

  it('collapses whitespace in normalize', async () => {
    const records = await normalize([mappedRecord({ villageName: ' Galotha  Bk ' })], testCtx());
    expect(records[0]!.villageName).toBe('Galotha Bk');
  });

  it('deduplicates on village + panchayat code', async () => {
    const a = mappedRecord();
    const { kept, removed } = await deduplicate([a, { ...a, villageCode: 999999 }, a]);
    expect(kept).toHaveLength(2);
    expect(removed).toHaveLength(1);
    expect(naturalKey(a)).toBe('525175:182109');
  });
});

describe('validate', () => {
  it('accepts mapped and unmapped records', async () => {
    const validate = createValidator();
    const outcome = await validate(
      [mappedRecord(), mappedRecord({ panchayatCode: null, panchayatName: null })],
      testCtx(),
    );
    expect(outcome.valid).toHaveLength(2);
    expect(outcome.invalid).toHaveLength(0);
  });

  it('rejects records with missing codes or names', async () => {
    const validate = createValidator();
    const outcome = await validate(
      [
        { ...mappedRecord(), villageCode: 0 },
        { ...mappedRecord(), stateName: '' },
        { ...mappedRecord(), panchayatName: null },
      ],
      testCtx(),
    );
    expect(outcome.valid).toHaveLength(0);
    expect(outcome.invalid.map((r) => r.errors)).toEqual([
      ['village code is required'],
      ['state name is required'],
      ['local body name is required when a local body code is present'],
    ]);
  });
});

describe('loader (fake pool)', () => {
  it('upserts the five hierarchy tables in FK order', async () => {
    const queries: { sql: string; params: unknown[] }[] = [];
    const pool = {
      query: async (sql: string, params: unknown[]) => {
        queries.push({ sql, params });
        return { rows: [], rowCount: 1 };
      },
    } as never;

    const loader = createHierarchyLoader(pool);
    const result = await loader([mappedRecord()], testCtx());

    expect(result.upserted).toBe(1);
    const tables = queries.map((q) => /INSERT INTO (\w+)/.exec(q.sql)![1]);
    expect(tables).toEqual(['states', 'districts', 'talukas', 'panchayats', 'villages']);

    const states = queries.find((q) => q.sql.includes('INSERT INTO states'));
    expect(states!.params).toEqual([27, 'MAHARASHTRA', 'MAHARASHTRA']);

    const districts = queries.find((q) => q.sql.includes('INSERT INTO districts'));
    expect(districts!.params).toEqual([486, 'NANDURBAR', 'NANDURBAR', 27]);
    expect(districts!.sql).toContain('JOIN states p ON p.lgd_code = v.parent_code');

    const villages = queries.find((q) => q.sql.includes('INSERT INTO villages'));
    expect(villages!.params).toEqual([525175, 'Galotha Bk', 'Galotha Bk', 3950, 182109]);
    expect(villages!.sql).toContain('LEFT JOIN panchayats p ON p.lgd_code = v.panchayat_code');
  });

  it('is idempotent: unchanged codes collapse to one row per table', async () => {
    const queries: { sql: string; params: unknown[] }[] = [];
    const pool = {
      query: async (sql: string, params: unknown[]) => {
        queries.push({ sql, params });
        return { rows: [], rowCount: 1 };
      },
    } as never;

    const loader = createHierarchyLoader(pool);
    const dupes = [
      mappedRecord(),
      mappedRecord({ villageCode: 525175 }),
      mappedRecord({ villageCode: 525067 }),
    ];
    await loader(dupes, testCtx());

    const states = queries.filter((q) => q.sql.includes('INSERT INTO states'));
    const villages = queries.filter((q) => q.sql.includes('INSERT INTO villages'));
    expect(states[0]!.params).toContain('MAHARASHTRA');
    expect(villages[0]!.params).toContain('Galotha Bk');
    // All three dupes share one state and one taluk; only the two unique
    // villages upsert into the villages table.
    expect(states).toHaveLength(1);
    expect(villages).toHaveLength(1);
    expect(villages[0]!.params).toContain(525067);
  });
});

describe('pipeline', () => {
  it('runs end-to-end from a real capture', async () => {
    const fixture = JSON.parse(readFixture());
    const payloads = [
      fixture,
      { success: true, result: { total: fixture.result.records.length, records: [] } },
    ];
    let call = 0;
    const fetchFn = async () => new Response(JSON.stringify(payloads[call++]!), { status: 200 });

    const queries: { sql: string; params: unknown[] }[] = [];
    const pool = {
      query: async (sql: string, params: unknown[]) => {
        queries.push({ sql, params });
        return { rows: [], rowCount: 1 };
      },
    } as never;

    const deadLetter = memoryDeadLetter();
    const audit = memoryAudit();
    const pipeline = buildLgdPipeline({
      sourceConfig: sourceConfig({ pageSize: 2 }),
      pool,
      fetchFn,
      pipeline: {
        config: testConfig({ batchSize: 2 }),
        deadLetter: deadLetter.sink,
        audit: audit.sink,
      },
    });

    const report = await pipeline.run();

    expect(report.status).toBe('success');
    expect(report.counts.rowsSeen).toBeGreaterThan(0);
    expect(report.counts.rowsUpserted).toBeGreaterThan(0);
    expect(deadLetter.items).toHaveLength(0);
    expect(audit.runs[0]?.source).toBe('lgd');
  });
});

function readFixture(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  return readFileSync(join(here, 'fixtures', 'lgd', 'village-gp-mapping.json'), 'utf8');
}
