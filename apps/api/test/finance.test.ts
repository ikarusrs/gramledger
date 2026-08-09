import { describe, it, expect } from 'vitest';
import type { Db } from '../src/lib/db';
import type { Bindings } from '../src/config';
import { buildApp } from '../src/app';

const testBindings: Bindings = { ENVIRONMENT: 'test', LOG_LEVEL: 'error' };

describe('GET /v1/panchayats/:id/finance', () => {
  it('returns totals and grouped scheme summaries for the requested fy', async () => {
    let queryCount = 0;
    const db: Db = {
      async query(sql, _params = []) {
        queryCount++;
        if (sql.includes('WHERE id =')) return [{ id: 1 }];
        if (sql.includes('SELECT fy FROM')) return [{ fy: 2026 }, { fy: 2025 }];
        if (sql.includes('FROM grants')) {
          return [
            {
              scheme_id: 5,
              code: 'MNREGA',
              name_mr: 'मनरेगा',
              name_en: 'NREGA',
              ministry: 'RD',
              amount: 100.5,
              source: 'egramswaraj',
              disbursed_at: '2025-06-01',
            },
          ];
        }
        if (sql.includes('FROM expenditures')) {
          return [
            {
              scheme_id: 6,
              code: '15FC',
              name_mr: 'पंंच',
              name_en: 'FC',
              ministry: null,
              head: 'Materials',
              amount: 25,
            },
            {
              scheme_id: 5,
              code: 'a',
              name_mr: 'm',
              name_en: 'a',
              ministry: 'RD',
              head: 'Wages',
              amount: 10,
            },
          ];
        }
        return [];
      },
    };

    const res = await buildApp({ db }).request(
      '/v1/panchayats/1/finance?fy=2026',
      {},
      testBindings,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      fy: string;
      availableFys: number[];
      summary: {
        totalGrants: number;
        totalExpenditure: number;
        balance: number;
        grants: { amount: number; scheme: { id: number } }[];
        expenditures: { amount: number; head: string }[];
        byScheme: { grants: number; expenditure: number }[];
      };
    };

    expect(body.fy).toBe('2026');
    expect(body.availableFys).toEqual([2026, 2025]);
    expect(body.summary.totalGrants).toBe(100.5);
    expect(body.summary.totalExpenditure).toBe(35);
    expect(body.summary.balance).toBe(65.5);
    expect(body.summary.grants).toHaveLength(1);
    expect(body.summary.grants[0]?.amount).toBe(100.5);
    expect(body.summary.expenditures).toHaveLength(2);
    expect(body.summary.byScheme).toHaveLength(2);
    const byScheme = body.summary.byScheme;
    const nrega = byScheme.find((s) => s.grants > 0);
    expect(nrega?.expenditure).toBe(10);
    expect(queryCount).toBe(4);
  });

  it('defaults fy to the most recent available and computes zero totals when empty', async () => {
    const db: Db = {
      async query(sql, _params = []) {
        if (sql.includes('WHERE id =')) return [{ id: 1 }];
        if (sql.includes('SELECT fy FROM')) return [{ fy: 3004 }, { fy: 400 }];
        if (sql.includes('FROM grants')) return [];
        if (sql.includes('FROM expenditures')) return [];
        return [];
      },
    };

    const res = await buildApp({ db }).request('/v1/panchayats/1/finance', {}, testBindings);
    const body = (await res.json()) as { fy: string; summary: { balance: number } };
    expect(body.fy).toBe('3004');
    expect(body.summary.balance).toBe(0);
  });

  it('returns 404 for an unknown panchayat', async () => {
    const db: Db = {
      async query(sql) {
        if (sql.includes('SELECT id =')) return [];
        return [];
      },
    };
    const res = await buildApp({ db }).request('/v1/panchayats/999/finance', {}, testBindings);
    expect(res.status).toBe(404);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe('NOT_FOUND');
  });
});
