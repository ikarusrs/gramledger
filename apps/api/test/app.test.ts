import { describe, it, expect } from 'vitest';
import { buildApp } from '../src/app';
import type { Bindings } from '../src/config';

const testBindings: Bindings = { ENVIRONMENT: 'test', LOG_LEVEL: 'error' };

describe('gramledger-api', () => {
  it('GET /health returns ok', async () => {
    const res = await buildApp().request('/health', {}, testBindings);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string; service: string };
    expect(body.status).toBe('ok');
    expect(body.service).toBe('gramledger-api');
  });

  it('unknown route returns a JSON 404', async () => {
    const res = await buildApp().request('/does-not-exist', {}, testBindings);
    expect(res.status).toBe(404);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe('NOT_FOUND');
  });

  it('v1 namespace is mounted', async () => {
    const res = await buildApp().request('/v1/', {}, testBindings);
    expect(res.status).toBe(404);
  });
});
