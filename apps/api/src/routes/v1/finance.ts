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

interface SchemeExpenditureRow extends Row {
  scheme: string;
  source: string;
  receipts: number;
  payments: number;
}

interface StatementRow extends Row {
  opening_balance: number | null;
}

/**
 * Synthesizes the API `Scheme` from the denormalized scheme text stored in
 * `scheme_expenditures`. Source schemes have no LGD code or curated identity,
 * so `id`/`lgdCode` come from a stable hash of the scheme name and both name
 * fields carry the source text (English-only until the scheme catalog exists).
 */
function synthesizeScheme(scheme: string): Scheme {
  const hash = fnv1a(scheme);
  let slug = scheme
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (slug.length === 0) slug = 'scheme';
  if (slug.length > 32) slug = slug.slice(0, 32);
  return {
    id: hash,
    lgdCode: String(hash),
    code: `${slug}-${hash.toString(16)}`,
    nameMr: scheme,
    nameEn: scheme,
    ministry: null,
  };
}

/** FNV-1a 32-bit hash; stable across runs and processes. */
function fnv1a(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
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
    SELECT fy FROM scheme_expenditures WHERE panchayat_id = $1
    UNION
    SELECT fy FROM financial_statements WHERE panchayat_id = $1
  ) f
  ORDER BY fy DESC
`;

const SCHEME_EXPENDITURES_SQL = `
  SELECT scheme, source, SUM(receipts) AS receipts, SUM(payments) AS payments
  FROM scheme_expenditures
  WHERE panchayat_id = $1 AND fy = $2
  GROUP BY scheme, source
  ORDER BY scheme, source
`;

const OPENING_BALANCE_SQL = `
  SELECT opening_balance
  FROM financial_statements
  WHERE panchayat_id = $1 AND fy = $2 AND opening_balance IS NOT NULL
  ORDER BY month_no ASC NULLS FIRST
  LIMIT 1
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

    const schemeRows = (await db.query(SCHEME_EXPENDITURES_SQL, [
      id,
      fy,
    ])) as SchemeExpenditureRow[];

    const toScheme = (scheme: string): Scheme => synthesizeScheme(scheme);

    const grants: GrantRow[] = schemeRows
      .filter((row) => Number(row.receipts) > 0)
      .map((row) => ({
        scheme: toScheme(row.scheme),
        amount: Number(row.receipts),
        source: row.source,
        disbursedAt: null,
      }));
    const expenditures: ExpenditureRow[] = schemeRows
      .filter((row) => Number(row.payments) > 0)
      .map((row) => ({
        scheme: toScheme(row.scheme),
        head: '',
        amount: Number(row.payments),
      }));

    const byScheme = new Map<number, SchemeSummary>();
    for (const row of schemeRows) {
      const scheme = row.scheme;
      const entry = byScheme.get(fnv1a(scheme)) ?? {
        scheme: toScheme(scheme),
        grants: 0,
        expenditure: 0,
      };
      entry.grants += Number(row.receipts);
      entry.expenditure += Number(row.payments);
      byScheme.set(fnv1a(scheme), entry);
    }

    const totalGrants = schemeRows.reduce((sum, r) => sum + Number(r.receipts), 0);
    const totalExpenditure = schemeRows.reduce((sum, r) => sum + Number(r.payments), 0);

    // Default to the receipts-minus-payments difference; when a panchayat has
    // no scheme data for the fy, fall back to the statement opening balance so
    // the screen never reports an empty zero when statements exist.
    let balance = totalGrants - totalExpenditure;
    if (schemeRows.length === 0) {
      const statements = (await db.query(OPENING_BALANCE_SQL, [id, fy])) as StatementRow[];
      if (statements[0]?.opening_balance != null) {
        balance = Number(statements[0].opening_balance);
      }
    }

    c.header('Cache-Control', 'public, max-age=3600');
    return c.json({
      fy: String(fy),
      availableFys,
      summary: {
        totalGrants,
        totalExpenditure,
        balance,
        byScheme: [...byScheme.values()],
        grants,
        expenditures,
      },
    } satisfies PanchayatFinance);
  },
);
