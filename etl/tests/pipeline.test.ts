import { describe, expect, it } from 'vitest';
import { createPipeline } from '../src/core/pipeline.js';
import { ETLError } from '../src/core/errors.js';
import type { ETLRecord } from '../src/core/types.js';
import {
  dedupeByKey,
  failingFetcher,
  fakeFetcher,
  fakeLoader,
  fakeParser,
  fakeTransformer,
  fakeValidator,
  identityNormalizer,
  memoryAudit,
  memoryDeadLetter,
  testConfig,
} from './helpers.js';

type MarketRecord = ETLRecord & {
  market: string;
  commodity: string;
  price: number;
};

const rows: MarketRecord[] = [
  { market: 'Pune', commodity: 'Onion', price: 1500 },
  { market: 'Pune', commodity: 'Potato', price: 1200 },
  { market: 'Satara', commodity: 'Onion', price: 1550 },
  { market: 'Satara', commodity: 'Tomato', price: 900 },
  { market: 'Kolhapur', commodity: 'Onion', price: 1600 },
];

const byMarketCommodity = (r: MarketRecord) => `${r.market}:${r.commodity}`;

describe('pipeline happy path', () => {
  it('loads all records in batches and reports success', async () => {
    const { loader, calls } = fakeLoader<MarketRecord>();
    const report = await createPipeline<MarketRecord>(
      'markets',
      {
        fetch: fakeFetcher('fake'),
        parse: fakeParser(rows),
        validate: fakeValidator(),
        normalize: identityNormalizer(),
        load: loader,
      },
      { config: testConfig({ batchSize: 2 }) },
    ).run();

    expect(report.status).toBe('success');
    expect(report.counts).toMatchObject({
      rowsSeen: 5,
      rowsUpserted: 5,
      rowsSkipped: 0,
      rowsFailed: 0,
      duplicatesRemoved: 0,
      validationFailures: 0,
    });
    expect(calls).toHaveLength(3);
    expect(calls.map((c) => c.length)).toEqual([2, 2, 1]);
    expect(report.errors).toEqual([]);
    expect(report.retryCount).toBe(0);
  });

  it('skips the loader when there are no records', async () => {
    const { loader, calls } = fakeLoader<MarketRecord>();
    const report = await createPipeline<MarketRecord>(
      'markets',
      {
        fetch: fakeFetcher(''),
        parse: fakeParser([]),
        validate: fakeValidator(),
        normalize: identityNormalizer(),
        load: loader,
      },
      { config: testConfig() },
    ).run();

    expect(report.status).toBe('success');
    expect(report.counts.rowsSeen).toBe(0);
    expect(calls).toEqual([]);
  });
});

describe('pipeline validation', () => {
  it('dead-letters invalid records and counts them as failed', async () => {
    const deadLetter = memoryDeadLetter();
    const report = await createPipeline<MarketRecord>(
      'markets',
      {
        fetch: fakeFetcher('fake'),
        parse: fakeParser(rows),
        validate: fakeValidator((r) => (r.price <= 1200 ? ['price below floor'] : [])),
        normalize: identityNormalizer(),
        load: fakeLoader<MarketRecord>().loader,
      },
      { config: testConfig(), deadLetter: deadLetter.sink },
    ).run();

    expect(report.status).toBe('success');
    expect(report.counts).toMatchObject({
      rowsSeen: 5,
      rowsUpserted: 3,
      rowsFailed: 2,
      validationFailures: 2,
    });
    expect(deadLetter.items).toHaveLength(1);
    expect(deadLetter.items[0]).toMatchObject({
      source: 'markets',
      stage: 'validate',
      reason: 'validation failed',
    });
    expect(deadLetter.items[0]!.records).toHaveLength(2);
  });
});

describe('pipeline deduplicate and transform', () => {
  it('counts duplicates as skipped', async () => {
    const report = await createPipeline<MarketRecord>(
      'markets',
      {
        fetch: fakeFetcher('fake'),
        parse: fakeParser([...rows, rows[0]!]),
        validate: fakeValidator(),
        normalize: identityNormalizer(),
        deduplicate: dedupeByKey(byMarketCommodity),
        load: fakeLoader<MarketRecord>().loader,
      },
      { config: testConfig() },
    ).run();

    expect(report.status).toBe('success');
    expect(report.counts).toMatchObject({
      rowsSeen: 6,
      rowsUpserted: 5,
      duplicatesRemoved: 1,
      rowsSkipped: 1,
    });
  });

  it('counts transformed-away records as skipped', async () => {
    const report = await createPipeline<MarketRecord>(
      'markets',
      {
        fetch: fakeFetcher('fake'),
        parse: fakeParser(rows),
        validate: fakeValidator(),
        normalize: identityNormalizer(),
        transform: fakeTransformer((r) => r.price > 1000),
        load: fakeLoader<MarketRecord>().loader,
      },
      { config: testConfig() },
    ).run();

    expect(report.status).toBe('success');
    expect(report.counts).toMatchObject({ rowsSeen: 5, rowsUpserted: 4, rowsSkipped: 1 });
  });
});

describe('pipeline fetch retries', () => {
  it('retries a retryable fetch and succeeds', async () => {
    let attempts = 0;
    const report = await createPipeline<MarketRecord>(
      'markets',
      {
        fetch: async () => {
          attempts++;
          if (attempts < 3) throw new ETLError('FETCH_ERROR', 'flaky network', { retryable: true });
          return { content: 'ok', meta: { fetchedAt: new Date().toISOString() } };
        },
        parse: fakeParser(rows),
        validate: fakeValidator(),
        normalize: identityNormalizer(),
        load: fakeLoader<MarketRecord>().loader,
      },
      { config: testConfig({ retry: { attempts: 5, baseBackoffMs: 1, maxBackoffMs: 2 } }) },
    ).run();

    expect(report.status).toBe('success');
    expect(report.retryCount).toBe(2);
    expect(attempts).toBe(3);
  });

  it('exhausts retries and fails', async () => {
    const report = await createPipeline<MarketRecord>(
      'markets',
      {
        fetch: failingFetcher(new ETLError('FETCH_ERROR', 'still down', { retryable: true })),
        parse: fakeParser(rows),
        validate: fakeValidator(),
        normalize: identityNormalizer(),
        load: fakeLoader<MarketRecord>().loader,
      },
      { config: testConfig({ retry: { attempts: 4, baseBackoffMs: 1, maxBackoffMs: 2 } }) },
    ).run();

    expect(report.status).toBe('failed');
    expect(report.retryCount).toBe(3);
    expect(report.errors[0]).toMatchObject({ code: 'FETCH_ERROR', stage: 'fetch' });
    expect(report.errors[0]!.message).toContain('still down');
  });

  it('does not retry non-retryable fetch errors', async () => {
    const report = await createPipeline<MarketRecord>(
      'markets',
      {
        fetch: failingFetcher(new ETLError('CONFIG_ERROR', 'bad endpoint')),
        parse: fakeParser(rows),
        validate: fakeValidator(),
        normalize: identityNormalizer(),
        load: fakeLoader<MarketRecord>().loader,
      },
      { config: testConfig() },
    ).run();

    expect(report.status).toBe('failed');
    expect(report.retryCount).toBe(0);
    expect(report.errors[0]).toMatchObject({ code: 'FETCH_ERROR', stage: 'fetch' });
  });
});

describe('pipeline load failures', () => {
  it('dead-letters a failed batch and continues as partial', async () => {
    const deadLetter = memoryDeadLetter();
    let calls = 0;
    const loader = async (records: MarketRecord[]) => {
      calls++;
      if (calls === 1) throw new ETLError('LOAD_ERROR', 'constraint violation');
      return { upserted: records.length, inserted: records.length, updated: 0 };
    };

    const report = await createPipeline<MarketRecord>(
      'markets',
      {
        fetch: fakeFetcher('fake'),
        parse: fakeParser(rows.slice(0, 3)),
        validate: fakeValidator(),
        normalize: identityNormalizer(),
        load: loader,
      },
      { config: testConfig({ batchSize: 2 }), deadLetter: deadLetter.sink },
    ).run();

    expect(report.status).toBe('partial');
    expect(report.counts).toMatchObject({ rowsSeen: 3, rowsUpserted: 1, rowsFailed: 2 });
    expect(report.errors).toHaveLength(1);
    expect(report.errors[0]).toMatchObject({ code: 'LOAD_ERROR', stage: 'load' });
    expect(deadLetter.items).toHaveLength(1);
    expect(deadLetter.items[0]).toMatchObject({ source: 'markets', stage: 'load' });
    expect(deadLetter.items[0]!.records).toHaveLength(2);
  });
});

describe('pipeline audit', () => {
  it('persists a run report when an audit sink is provided', async () => {
    const audit = memoryAudit();
    const report = await createPipeline<MarketRecord>(
      'markets',
      {
        fetch: fakeFetcher('fake'),
        parse: fakeParser(rows),
        validate: fakeValidator(),
        normalize: identityNormalizer(),
        load: fakeLoader<MarketRecord>().loader,
      },
      { config: testConfig(), audit: audit.sink },
    ).run();

    expect(audit.runs).toHaveLength(1);
    expect(audit.runs[0]!.source).toBe('markets');
    expect(audit.runs[0]!.status).toBe('success');
    expect(audit.runs[0]).toEqual(report);
  });
});
