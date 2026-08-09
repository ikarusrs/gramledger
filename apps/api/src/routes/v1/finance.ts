import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import type { AppEnv } from '../../config';
import type { Db, Row } from '../../lib/db';
import { serviceUnavailable, notFound } from '../../lib/errors';

/** Response shapes mirror `apps/web/src/lib/api/types.ts#PanchayatFinance`. */

export interface Scheme {
  id: number;
  /** Schemes have no LGD code; the internal id stands in for the contract field. */
  lgdCode: string;
  code: string;
  nameMr: string;
  nameEn: string;
  ministry: string | null;
}

export interface GrantRow {
  scheme: Scheme;
  amount: number;
  source: string;
  disbursedAt: string | null;
}

export interface ExpenditureRow {
  scheme: Scheme;
  head: string;
  amount: number;
}

export interface SchemeSummary {
  scheme: Scheme;
  grants: number;
  expenditure: number;
}

export interface FinanceSummary {
  totalGrants: number;
  totalExpenditure: number;
  balance: number;
  byScheme: SchemeSummary[];
  grants: GrantRow[];
  expenditures: ExpenditureRow[];
}

export interface PanchayatFinance {
  fy: string;
  availableFys: number[];
  summary: FinanceSummary;
}

interface SchemeRow extends Row {
  scheme_id: number;
  code: string;
  name_mr: string;
  name_en: string;
  ministry: string | null;
}

interface GrantFinanceRow extends SchemeRow {
  amount: number;
  source: string;
  disbursed_at: string | null;
}

interface ExpenditureFinanceRow extends SchemeRow {
  head: string;
  amount: number;
}

const financeParams = z.object({
  id: z.coerce.number().int().positive(),
});

const financeQuery = z.object({
  fy: z.coerce.number().int().min(2000).max(2100).optional(),
});

/** Financial year (Apr–Mar) containing today, e.g. 2026 for 2026-27. */
function currentFy(): number {
  const now = new Date();
  return now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
}

const AVAILABLE_FYS_SQL = `
  SELECT fy FROM (
    SELECT fy FROM grants WHERE panchayat_id = $1
    UNION
    SELECT fy FROM expenditures WHERE panchayat_id = $1
  ) f
  ORDER BY fy DESC
`;

export const financeRouter = new Hono<AppEnv>();

financeRouter.get(
  '/panchayats/:id/finance',
  zValidator('param', financeParams),
  zValidator('query', financeQuery),
  async (c) => {
    const db = c.get('db') as Db | undefined;
    if (!db) throw serviceUnavailable();

    const { id } = c.req.valid('param');
    const requestedFy = c.req.valid('query').fy;

    const panchayat = (await db.query('SELECT id FROM panchayats WHERE id = $1', [id])) as Row[];
    if (panchayat.length === 0) throw notFound('Panchayat not found');

    const fyRows = (await db.query(AVAILABLE_FYS_SQL, [id])) as { fy: number }[];
    const availableFys = fyRows.map((r) => r.fy);
    const fy = requestedFy ?? availableFys[0] ?? currentFy();

    const grantRows = (await db.query(
      `SELECT
         s.id AS scheme_id, s.code, s.name_mr, s.name_en, s.ministry,
         g.amount, g.source, g.disbursed_at
       FROM grants g
       JOIN schemes s ON s.id = g.scheme_id
       WHERE g.panchayat_id = $1 AND g.fy = $2
       ORDER BY s.name_en`,
      [id, fy],
    )) as GrantFinanceRow[];

    const expenditureRows = (await db.query(
      `SELECT
         s.id AS scheme_id, s.code, s.name_mr, s.name_en, s.ministry,
         e.head, e.amount
       FROM expenditures e
       JOIN schemes s ON s.id = e.scheme_id
       WHERE e.panchayat_id = $1 AND e.fy = $2
       ORDER BY s.name_en, e.head`,
      [id, fy],
    )) as ExpenditureFinanceRow[];

    const toScheme = (row: SchemeRow): Scheme => ({
      id: row.scheme_id,
      lgdCode: String(row.scheme_id),
      code: row.code,
      nameMr: row.name_mr,
      nameEn: row.name_en,
      ministry: row.ministry,
    });

    const grants: GrantRow[] = grantRows.map((row) => ({
      scheme: toScheme(row),
      amount: Number(row.amount),
      source: row.source,
      disbursedAt: row.disbursed_at,
    }));
    const expenditures: ExpenditureRow[] = expenditureRows.map((row) => ({
      scheme: toScheme(row),
      head: row.head,
      amount: Number(row.amount),
    }));

    const byScheme = new Map<number, SchemeSummary>();
    for (const row of grantRows) {
      const entry = byScheme.get(row.scheme_id) ?? {
        scheme: toScheme(row),
        grants: 0,
        expenditure: 0,
      };
      entry.grants += Number(row.amount);
      byScheme.set(row.scheme_id, entry);
    }
    for (const row of expenditureRows) {
      const entry = byScheme.get(row.scheme_id) ?? {
        scheme: toScheme(row),
        grants: 0,
        expenditure: 0,
      };
      entry.expenditure += Number(row.amount);
      byScheme.set(row.scheme_id, entry);
    }

    const totalGrants = grants.reduce((sum, g) => sum + g.amount, 0);
    const totalExpenditure = expenditures.reduce((sum, e) => sum + e.amount, 0);

    c.header('Cache-Control', 'public, max-age=3600');
    return c.json({
      fy: String(fy),
      availableFys,
      summary: {
        totalGrants,
        totalExpenditure,
        balance: totalGrants - totalExpenditure,
        byScheme: [...byScheme.values()],
        grants,
        expenditures,
      },
    } satisfies PanchayatFinance);
  },
);
