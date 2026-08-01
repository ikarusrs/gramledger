import { describe, expect, it } from 'vitest';
import { ETLError, describeError, isRetryable } from '../src/core/errors.js';

describe('ETLError', () => {
  it('builds an envelope-shaped payload', () => {
    const err = new ETLError('FETCH_ERROR', 'boom');
    expect(err.code).toBe('FETCH_ERROR');
    expect(err.toJSON()).toEqual({
      error: {
        code: 'FETCH_ERROR',
        message: 'boom',
        source: undefined,
        stage: undefined,
        details: {},
      },
      retryable: false,
    });
  });

  it('is an instanceof Error with a cause', () => {
    const cause = new Error('underlying');
    const err = new ETLError('PARSE_ERROR', 'bad', { cause });
    expect(err).toBeInstanceOf(Error);
    expect(err.cause).toBe(cause);
  });

  it('round-trips through JSON.stringify without a circular error', () => {
    const err = new ETLError('LOAD_ERROR', 'nope');
    const text = JSON.stringify(err);
    expect(JSON.parse(text).error.code).toBe('LOAD_ERROR');
  });
});

describe('isRetryable / describeError', () => {
  it('classifies a retryable ETLError', () => {
    const err = new ETLError('FETCH_ERROR', 'timeout', { retryable: true });
    expect(isRetryable(err)).toBe(true);
  });

  it('classifies a non-retryable ETLError', () => {
    const err = new ETLError('CONFIG_ERROR', 'bad config');
    expect(isRetryable(err)).toBe(false);
  });

  it('classifies unknown errors as retryable-unknown', () => {
    const desc = describeError(new Error('mystery'));
    expect(desc.retryable).toBeUndefined();
  });

  it('never leaks the envelope into the message', () => {
    const err = new ETLError('FETCH_ERROR', 'real message');
    expect(describeError(err).message).toBe('real message');
  });
});
