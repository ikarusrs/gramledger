import { describe, it, expect } from 'vitest';
import { buildApp } from '../src/app';
import type { Bindings } from '../src/config';
import type { Hierarchy, Panchayat, PanchayatDetail, PanchayatFinance } from '../src/data/types';

const testBindings: Bindings = { ENVIRONMENT: 'test', LOG_LEVEL: 'error' };

describe('GET /v1/hierarchy', () => {
  it('returns districts with talukas and villages', async () => {
    const res = await buildApp().request('/v1/hierarchy', {}, testBindings);
    expect(res.status).toBe(200);
    const body = (await res.json()) as Hierarchy;
    expect(body.districts).toHaveLength(5);
    const pune = body.districts.find((d) => d.nameEn === 'Pune');
    expect(pune?.talukas).toHaveLength(2);
    expect(pune?.talukas[0]?.villages.length).toBeGreaterThan(0);
    const wadgaon = pune?.talukas[0]?.villages[0];
    expect(wadgaon?.nameMr).toBe('वडगाव बुद्रुक');
  });
});

describe('GET /v1/panchayats', () => {
  it('returns all panchayats when no filters are given', async () => {
    const res = await buildApp().request('/v1/panchayats', {}, testBindings);
    expect(res.status).toBe(200);
    const body = (await res.json()) as Panchayat[];
    expect(body).toHaveLength(8);
    expect(body[0]).toMatchObject({
      id: 101,
      lgdCode: '270010101',
      districtNameEn: 'Pune',
      talukaNameEn: 'Haveli',
      level: 'gram',
    });
  });

  it('searches by q (case-insensitive, matches Marathi and English)', async () => {
    const res = await buildApp().request('/v1/panchayats?q=wad', {}, testBindings);
    const body = (await res.json()) as Panchayat[];
    expect(body.map((p) => p.id)).toEqual([101]);
  });

  it('filters by district and taluka', async () => {
    const byDistrict = await buildApp().request('/v1/panchayats?district=2', {}, testBindings);
    expect(((await byDistrict.json()) as Panchayat[]).map((p) => p.id)).toEqual([103, 104, 105]);

    const byTaluka = await buildApp().request('/v1/panchayats?taluka=202', {}, testBindings);
    expect(((await byTaluka.json()) as Panchayat[]).map((p) => p.id)).toEqual([105]);
  });

  it('returns an empty array when nothing matches', async () => {
    const res = await buildApp().request('/v1/panchayats?q=zzz', {}, testBindings);
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual([]);
  });

  it('rejects invalid filters with a 400 VALIDATION_ERROR', async () => {
    const res = await buildApp().request('/v1/panchayats?district=abc', {}, testBindings);
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('GET /v1/panchayats/:id', () => {
  it('returns the panchayat with its profile', async () => {
    const res = await buildApp().request('/v1/panchayats/101', {}, testBindings);
    expect(res.status).toBe(200);
    const body = (await res.json()) as PanchayatDetail;
    expect(body.id).toBe(101);
    expect(body.profile.sarpanchName).toBe('सुनील पवार');
    expect(body.profile.electedCommittee?.length).toBe(3);
  });

  it('returns nulls for missing profile fields', async () => {
    const res = await buildApp().request('/v1/panchayats/104', {}, testBindings);
    const body = (await res.json()) as PanchayatDetail;
    expect(body.profile.contactPhone).toBeNull();
    expect(body.profile.electedCommittee).toBeNull();
    expect(body.profile.sarpanchName).toBe('मंगल जाधव');
  });

  it('returns a 404 envelope for an unknown id', async () => {
    const res = await buildApp().request('/v1/panchayats/999', {}, testBindings);
    expect(res.status).toBe(404);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe('NOT_FOUND');
  });

  it('rejects a non-numeric id', async () => {
    const res = await buildApp().request('/v1/panchayats/abc', {}, testBindings);
    expect(res.status).toBe(400);
  });
});

describe('GET /v1/panchayats/:id/finance', () => {
  it('defaults to FY 2024 and returns the summary shape', async () => {
    const res = await buildApp().request('/v1/panchayats/101/finance', {}, testBindings);
    expect(res.status).toBe(200);
    const body = (await res.json()) as PanchayatFinance;
    expect(body.fy).toBe(2024);
    expect(body.availableFys).toEqual([2022, 2023, 2024]);
    expect(body.summary.byScheme).toHaveLength(5);
    expect(body.summary.grants.length).toBeGreaterThan(0);
    expect(body.summary.expenditures.length).toBeGreaterThan(0);
    expect(body.summary.balance).toBeCloseTo(
      body.summary.totalGrants - body.summary.totalExpenditure,
      2,
    );
  });

  it('honours the fy query parameter', async () => {
    const res = await buildApp().request('/v1/panchayats/101/finance?fy=2022', {}, testBindings);
    const body = (await res.json()) as PanchayatFinance;
    expect(body.fy).toBe(2022);
  });

  it('rejects an out-of-range fy', async () => {
    const res = await buildApp().request('/v1/panchayats/101/finance?fy=1999', {}, testBindings);
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns a 404 for an unknown panchayat', async () => {
    const res = await buildApp().request('/v1/panchayats/999/finance', {}, testBindings);
    expect(res.status).toBe(404);
  });
});
