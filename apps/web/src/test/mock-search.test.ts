import { describe, expect, it } from 'vitest';

import { searchMockPanchayats } from '../lib/api/mockData';

describe('searchMockPanchayats', () => {
  it('matches by Marathi name', () => {
    expect(searchMockPanchayats({ q: 'रामटेक' }).map((p) => p.id)).toEqual([106]);
  });

  it('matches by English name, case-insensitive', () => {
    expect(searchMockPanchayats({ q: 'wadgaon' }).map((p) => p.id)).toEqual([101]);
  });

  it('filters by district', () => {
    expect(searchMockPanchayats({ districtId: 2 }).map((p) => p.id)).toEqual([103, 104, 105]);
  });
});
