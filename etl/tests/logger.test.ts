import { describe, expect, it } from 'vitest';
import { collectingLogger } from './helpers.js';

describe('createLogger', () => {
  it('emits JSON lines for the given level', () => {
    const { logger, lines } = collectingLogger();
    logger.info('hello', { a: 1 });
    logger.warn('careful');
    expect(lines).toHaveLength(2);
    expect(lines[0]!).toMatchObject({ level: 'info', msg: 'hello', a: 1 });
    expect(lines[1]!).toMatchObject({ level: 'warn', msg: 'careful' });
  });

  it('filters below the configured level', () => {
    const { logger, lines } = collectingLogger('warn');
    logger.info('noisy');
    logger.error('real');
    expect(lines).toHaveLength(1);
    expect(lines[0]!.level).toBe('error');
  });

  it('redacts credentials in URL fields', () => {
    const { logger, lines } = collectingLogger();
    logger.info('conn', { databaseUrl: 'postgres://user:secret@host:5432/db?ssl=true' });
    expect(lines[0]!.databaseUrl).toBe('postgres://host:5432/db?ssl=true');
  });

  it('redacts password-valued fields outright', () => {
    const { logger, lines } = collectingLogger();
    logger.info('auth', { password: 's3cr3t' });
    expect(lines[0]!.password).toBe('[REDACTED]');
  });
});
