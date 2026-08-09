import { afterEach, describe, expect, it, vi } from 'vitest';

import { getHierarchy, searchPanchayats } from '../lib/api/endpoints';

describe('endpoints', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('falls back to demo data when the API is unreachable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('network down')));
    const res = await getHierarchy();
    expect(res.isMock).toBe(true);
    expect(res.data.districts.length).toBeGreaterThan(0);
  });

  it('searches demo panchayats', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('network down')));
    const res = await searchPanchayats({ q: 'रामटेक' });
    expect(res.isMock).toBe(true);
    expect(res.data.map((p) => p.id)).toEqual([106]);
  });
});
