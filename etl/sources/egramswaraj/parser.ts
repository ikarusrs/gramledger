import type { Parser } from '../../src/core/types.js';
import {
  monthFromLabel,
  parseFinancialYear,
  parseMoney,
  parsePage,
  type HtmlTable,
} from './html.js';
import type {
  EGramRecord,
  EGramReportEnvelope,
  EGramReportKind,
  ParseDiagnostics,
} from './types.js';
import { SOURCE_MONTHLY, SOURCE_VILLAGE } from './types.js';

export interface ParseResult {
  records: EGramRecord[];
  diagnostics: ParseDiagnostics[];
}

export function parseReport(envelope: EGramReportEnvelope): ParseResult {
  const page = parsePage(envelope.html);
  const financialYear = parseFinancialYear(envelope.html);
  const baseDiag: Omit<ParseDiagnostics, 'kind' | 'warnings'> = {
    tablesSeen: page.tables.length,
    rowsSeen: 0,
  };
  if (financialYear === undefined) {
    return {
      records: [],
      diagnostics: [{ kind: 'unknown', warnings: ['financial year not found'], ...baseDiag }],
    };
  }
  switch (page.level) {
    case 'monthly':
      return parseMonthlyStatement(page.tables, financialYear, envelope.url);
    case 'village':
      return parseVillageStatement(page.tables, financialYear, envelope.url);
    default:
      return {
        records: [],
        diagnostics: [
          {
            kind: 'skipped',
            warnings: ['aggregate report is not panchayat-level; skipped'],
            ...baseDiag,
          },
        ],
      };
  }
}

export const parseContent: Parser<EGramRecord> = async (input, ctx) => {
  const envelopes = JSON.parse(input.content) as EGramReportEnvelope[];
  if (!Array.isArray(envelopes)) throw new Error('eGramSwaraj fetch content must be an array');
  const all: EGramRecord[] = [];
  for (const envelope of envelopes) {
    const result = parseReport(envelope);
    all.push(...result.records);
    for (const diagnostic of result.diagnostics) {
      if (diagnostic.warnings.length > 0) {
        ctx.log.warn('eGramSwaraj parser warning', { url: envelope.url, ...diagnostic });
      }
      ctx.metrics.increment('parser.tables_seen', diagnostic.tablesSeen);
      ctx.metrics.increment('parser.rows_seen', diagnostic.rowsSeen);
    }
  }
  return all;
};

// ---------------------------------------------------------------------------
// Monthly GP statement ("Month Wise Payment and Receipt Statement")
// ---------------------------------------------------------------------------

const MONTH_COLUMNS = [
  '',
  'receipts',
  'receiptCancellation',
  'obCancellation',
  'payments',
  'paymentCancellation',
] as const;

function parseMonthlyStatement(
  tables: HtmlTable[],
  financialYear: number,
  sourceUrl: string,
): ParseResult {
  const data = findTable(tables, (row) => isMonthlyDataRow(row[0]));
  const diagBase = { kind: 'monthly_statement' as const, tablesSeen: tables.length };
  if (!data) {
    return {
      records: [],
      diagnostics: [{ ...diagBase, warnings: ['monthly statement table not found'], rowsSeen: 0 }],
    };
  }
  const context = data.rows.find((row) => /financial year:-\d{4}/i.test(row.join(' ')));
  const identity = context ? parseIdentity(context.join(' ')) : {};
  if (!identity.panchayatName) {
    return {
      records: [],
      diagnostics: [
        { ...diagBase, warnings: ['monthly statement has no panchayat identity'], rowsSeen: 0 },
      ],
    };
  }
  const records: EGramRecord[] = [];
  data.rows.forEach((row, index) => {
    const label = row[0];
    if (!label || isHeaderOrNav(label)) return;
    const base = {
      kind: 'monthly_statement' as EGramReportKind,
      source: SOURCE_MONTHLY,
      financialYear,
      sourceUrl,
      sourceHash: `${sourceUrl}#${index}`,
      ...identity,
      raw: Object.fromEntries(row.map((cell, i) => [String(i), cell])),
    };
    if (label && /^opening balance$/i.test(label)) {
      records.push({ ...base, period: 'opening_balance', openingBalance: parseMoney(row[1]) });
      return;
    }
    if (label && /^total$/i.test(label)) {
      records.push({
        ...base,
        period: 'total',
        receipts: parseMoney(row[1]),
        receiptCancellation: parseMoney(row[2]),
        obCancellation: parseMoney(row[3]),
        payments: parseMoney(row[4]),
        paymentCancellation: parseMoney(row[5]),
      });
      return;
    }
    const monthNo = monthFromLabel(label);
    if (monthNo === undefined) return;
    const values: Record<string, number | undefined> = {};
    MONTH_COLUMNS.forEach((column, i) => {
      if (column) values[column] = parseMoney(row[i]);
    });
    records.push({
      ...base,
      period: normalizePeriod(label),
      monthNo,
      ...values,
    });
  });
  return {
    records,
    diagnostics: [
      {
        ...diagBase,
        warnings: records.length === 0 ? ['monthly statement had no data rows'] : [],
        rowsSeen: records.length,
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// Village-wise statement (block page; one row per GP)
// ---------------------------------------------------------------------------

function parseVillageStatement(
  tables: HtmlTable[],
  financialYear: number,
  sourceUrl: string,
): ParseResult {
  const data = findTable(tables, (row) => row.length >= 3);
  const diagBase = { kind: 'village_statement' as const, tablesSeen: tables.length };
  if (!data) {
    return {
      records: [],
      diagnostics: [{ ...diagBase, warnings: ['village statement table not found'], rowsSeen: 0 }],
    };
  }
  const context = data.rows.find((row) => /state:-/i.test(row.join(' ')));
  const identity = context ? parseIdentity(context.join(' ')) : {};
  const records: EGramRecord[] = [];
  data.rows.forEach((row, index) => {
    const name = row[0]?.trim();
    if (
      !name ||
      isHeaderOrNav(name) ||
      /^total$/i.test(name) ||
      /financial year|wise (receipt|payment) and payment statement/i.test(name)
    ) {
      return;
    }
    records.push({
      kind: 'village_statement',
      source: SOURCE_VILLAGE,
      financialYear,
      period: 'total',
      sourceUrl,
      sourceHash: `${sourceUrl}#${index}`,
      ...identity,
      panchayatName: name,
      receipts: parseMoney(row[1]),
      payments: parseMoney(row[2]),
      raw: Object.fromEntries(row.map((cell, i) => [String(i), cell])),
    });
  });
  return {
    records,
    diagnostics: [
      {
        ...diagBase,
        warnings: records.length === 0 ? ['village statement had no data rows'] : [],
        rowsSeen: records.length,
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function findTable(tables: HtmlTable[], match: (row: string[]) => boolean): HtmlTable | undefined {
  return tables.find((table) => table.rows.some(match));
}

function isMonthlyDataRow(label: string | undefined): boolean {
  if (!label) return false;
  return (
    /^opening balance$/i.test(label) ||
    /^total$/i.test(label) ||
    monthFromLabel(label) !== undefined
  );
}

function isHeaderOrNav(label: string): boolean {
  return (
    /^(month|village panchayat|back|export to excel)/i.test(label) ||
    /^closing balance$/i.test(label)
  );
}

function normalizePeriod(label: string): string {
  return label.replace(/,/g, ' ').replace(/\s+/g, ' ').trim();
}

function parseIdentity(text: string): {
  stateName?: string;
  districtName?: string;
  blockName?: string;
  panchayatName?: string;
} {
  const field = (name: string): string | undefined => {
    const match = new RegExp(`(?:^|[,\\s])${name}:-([^,]+?)(?=\\s+[A-Za-z &]+:-|,|$)`, 'i').exec(
      text,
    );
    return match?.[1]?.trim() || undefined;
  };
  return {
    stateName: field('State'),
    districtName: field('District'),
    blockName: field('Block Panchayat & Equivalent') ?? field('Block'),
    panchayatName: field('Village Panchayat & Equivalent'),
  };
}
