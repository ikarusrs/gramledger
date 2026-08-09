import { afterEach, describe, expect, it, vi } from 'vitest';

import { ApiError, client } from '../lib/api/client';

function stubFetch(response: Partial<Response>) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response));
}

describe('client', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns parsed JSON on success', async () => {
    stubFetch({ ok: true, status: 200, json: async () => ({ status: 'ok' }) });
    await expect(client.get('/health')).resolves.toEqual({ status: 'ok' });
  });

  it('throws ApiError carrying the envelope code on a 404', async () => {
    stubFetch({
      ok: false,
      status: 404,
      json: async () => ({ error: { code: 'NOT_FOUND', message: 'missing' } }),
    });
    const err = await client.get('/v1/nope').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ status: 404, code: 'NOT_FOUND', message: 'missing' });
  });
});
