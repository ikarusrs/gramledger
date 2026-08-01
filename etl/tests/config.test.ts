import { describe, expect, it } from 'vitest';
import { loadConfig } from '../src/core/config.js';

describe('loadConfig', () => {
  it('applies defaults', () => {
    const config = loadConfig({});
    expect(config.env).toBe('development');
    expect(config.logLevel).toBe('info');
    expect(config.retry).toEqual({ attempts: 3, baseBackoffMs: 1000, maxBackoffMs: 30000 });
    expect(config.batchSize).toBe(1000);
    expect(config.deadLetterDir).toBe('etl/.dead-letter');
    expect(config.databaseUrl).toBeUndefined();
  });

  it('reads environment overrides', () => {
    const config = loadConfig({
      ETL_ENV: 'production',
      ETL_LOG_LEVEL: 'debug',
      ETL_BATCH_SIZE: '42',
      DATABASE_URL: 'postgres://x',
    });
    expect(config.env).toBe('production');
    expect(config.logLevel).toBe('debug');
    expect(config.batchSize).toBe(42);
    expect(config.databaseUrl).toBe('postgres://x');
  });

  it('rejects unknown environments', () => {
    expect(() => loadConfig({ ETL_ENV: 'staging' })).toThrow(/ETL_ENV/i);
  });
});
