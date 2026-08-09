import { describe, it, expect } from 'vitest';
import type { Bindings } from '../src/config';
import type { Db, Row } from '../src/lib/db';
import { buildApp } from '../src/app';

const testBindings: Bindings = { ENVIRONMENT: 'test', LOG_LEVEL: 'error' };

function fakeDb(rows: Row[]): Db & { calls: { sql: string; params: unknown[] }[] } {
  const calls: { sql: string; params: unknown[] }[] = [];
  return {
    calls,
    async query(sql: string, params: unknown[] = []) {
      calls.push({ sql, params });
      return rows;
    },
  };
}

describe('GET /v1/hierarchy', () => {
  it('groups village rows into nested districts → talukas → villages', async () => {
    const db = fakeDb([
      {
        village_id: 11,
        village_code: '1001',
        village_name_mr: 'गाव',
        village_name_en: 'Village A',
        panchayat_id: 5,
        taluka_id: 2,
        taluka_code: '20',
        taluka_name_mr: 'तालुका',
        taluka_name_en: 'Taluka X',
        district_id: 1,
        district_code: '1',
        district_name_mr: 'जिल्हा',
        district_name_en: 'District Z',
      },
      {
        village_id: 12,
        village_code: '101',
        village_name_mr: 'गाव २',
        village_name_en: 'Village B',
        panchayat_id: null,
        taluka_id: 2,
        taluka_code: '20',
        taluka_name_mr: 'तालुका',
        taluka_name_en: 'Taluka X',
        district_id: 1,
        district_code: '1',
        district_name_mr: 'जिल्हा',
        district_name_en: 'District Z',
      },
    ]);

    const res = await buildApp({ db }).request('/v1/hierarchy', {}, testBindings);
    expect(res.status).toBe(200);
    type Village = { id: number; lgdCode: string; panchayatId: number | null };
    type Taluka = { id: number; lgdCode: string; villages: Village[] };
    type District = { id: number; lgdCode: string; nameEn: string; talukas: Taluka[] };
    const body = (await res.json()) as { districts: District[] };

    expect(body.districts).toHaveLength(1);
    expect(body.districts[0]).toMatchObject({ id: 1, lgdCode: '1', nameEn: 'District Z' });
    expect(body.districts[0]?.talukas).toHaveLength(1);
    expect(body.districts[0]?.talukas[0]).toMatchObject({
      id: 2,
      lgdCode: '20',
      nameEn: 'Taluka X',
    });
    expect(body.districts[0]?.talukas[0]?.villages).toHaveLength(2);
    expect(body.districts[0]?.talukas[0]?.villages[0]).toMatchObject({
      id: 11,
      lgdCode: '1001',
      panchayatId: 5,
    });
    expect(body.districts[0]?.talukas[0]?.villages[1]?.panchayatId).toBeNull();
    expect(db.calls[0]?.sql).toMatch(/FROM villages v/);
    expect(res.headers.get('cache-control')).toBe('public, max-age=3600');
  });

  it('returns 503 DB_UNAVAILABLE when no database is configured', async () => {
    const res = await buildApp().request('/v1/hierarchy', {}, testBindings);
    expect(res.status).toBe(503);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe('DB_UNAVAILABLE');
  });
});

describe('GET /v1/panchayats', () => {
  it('returns mapped panchayat rows', async () => {
    const db = fakeDb([
      {
        id: 7,
        lgd_code: '700',
        name_mr: 'पंचायत',
        name_en: 'Panchayat A',
        level: 'gram',
        district_id: 1,
        district_name_mr: 'जिल्हा',
        district_name_en: 'District Z',
        taluka_id: 2,
        taluka_name_mr: 'तालुका',
        taluka_name_en: 'Taluka X',
      },
    ]);

    const res = await buildApp({ db }).request('/v1/panchayats?q=akole', {}, testBindings);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      id: number;
      lgdCode: string;
      nameEn: string;
      level: string;
    }[];
    expect(body).toEqual([
      {
        id: 7,
        lgdCode: '700',
        nameEn: 'Panchayat A',
        nameMr: 'पंचायत',
        level: 'gram',
        districtId: 1,
        districtNameMr: 'जिल्हा',
        districtNameEn: 'District Z',
        talukaId: 2,
        talukaNameMr: 'तालुका',
        talukaNameEn: 'Taluka X',
      },
    ]);
    expect(db.calls[0]!.sql).toMatch(/ILIKE/);
  });

  it('passes query and filter params positionally', async () => {
    const db = fakeDb([]);
    await buildApp({ db }).request('/v1/panchayats?q=ak&districtId=1&talukaId=2', {}, testBindings);
    const { sql, params } = db.calls[0]!;
    expect(sql).toContain('p.name_en ILIKE $1');
    expect(sql).toContain('p.district_id = $2');
    expect(sql).toContain('p.taluka_id = $3');
    expect(params).toEqual(['%ak%', 1, 2]);
  });
});
