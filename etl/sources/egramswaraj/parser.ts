import type { Parser } from '../../src/core/types.js';
import { extractTables, normalizeHeader, parseFinancialYear, parseMoney } from './html.js';
import type {
  EGramRecord,
  EGramReportEnvelope,
  EGramReportKind,
  ParseDiagnostics,
} from './types.js';

export interface ParseResult {
  records: EGramRecord[];
  diagnostics: ParseDiagnostics[];
}

export function parseReport(envelope: EGramReportEnvelope): ParseResult {
  const tables = extractTables(envelope.html);
  const financialYear = parseFinancialYear(envelope.html);
  if (financialYear === undefined) {
    return {
      records: [],
      diagnostics: [
        {
          kind: 'unknown',
          warnings: ['financial year not found'],
          tablesSeen: tables.length,
          rowsSeen: 0,
        },
      ],
    };
  }
  const kind = classify(envelope.html, tables);
  if (!kind) {
    return {
      records: [],
      diagnostics: [
        {
          kind: 'unknown',
          warnings: ['report type not recognized'],
          tablesSeen: tables.length,
          rowsSeen: 0,
        },
      ],
    };
  }
  const records = tables.flatMap((table) => parseTable(table, kind, financialYear, envelope.url));
  return {
    records,
    diagnostics: [
      {
        kind,
        warnings: records.length === 0 ? ['recognized report had no data rows'] : [],
        tablesSeen: tables.length,
        rowsSeen: records.length,
      },
    ],
  };
}

export const parseContent: Parser<EGramRecord> = async (input, ctx) => {
  const envelopes = JSON.parse(input.content) as EGramReportEnvelope[];
  if (!Array.isArray(envelopes)) throw new Error('eGramSwaraj fetch content must be an array');
  const all: EGramRecord[] = [];
  for (const envelope of envelopes) {
    const result = parseReport(envelope);
    all.push(...result.records);
    for (const diagnostic of result.diagnostics) {
      if (diagnostic.warnings.length > 0)
        ctx.log.warn('eGramSwaraj parser warning', { url: envelope.url, ...diagnostic });
      ctx.metrics.increment('parser.tables_seen', diagnostic.tablesSeen);
      ctx.metrics.increment('parser.rows_seen', diagnostic.rowsSeen);
    }
  }
  return all;
};

function classify(
  html: string,
  tables: ReturnType<typeof extractTables>,
): EGramReportKind | undefined {
  const text = html.toLowerCase();
  if (/scheme[- ]wise expenditure/.test(text)) return 'scheme_expenditure';
  if (/district wise receipt|state wise receipt/.test(text)) return 'district_expenditure';
  if (/panchayat profile|profile details/.test(text)) return 'panchayat_profile';
  if (/asset/.test(text) && tables.some((table) => table.headers.some((h) => /asset/i.test(h))))
    return 'asset';
  if (
    /activity|public work/.test(text) &&
    tables.some((table) => table.headers.some((h) => /activity|work/i.test(h)))
  )
    return 'public_work';
  return undefined;
}

function parseTable(
  table: ReturnType<typeof extractTables>[number],
  kind: EGramReportKind,
  financialYear: number,
  sourceUrl: string,
): EGramRecord[] {
  const headers = table.headers.map(normalizeHeader);
  return table.rows
    .map((cells, index): EGramRecord | undefined => {
      const raw = Object.fromEntries(
        headers.map((header, i) => [header || `column_${i}`, cells[i] ?? '']),
      );
      const name = cells.find((cell) => cell && !/^[\d,().-]+$/.test(cell));
      if (!name || /^total$/i.test(name)) return undefined;
      const base: EGramRecord = {
        kind,
        financialYear,
        sourceUrl,
        sourceHash: `${sourceUrl}#${index}`,
        raw,
      };
      if (kind === 'district_expenditure' || kind === 'scheme_expenditure') {
        const money = cells
          .map((cell) => parseMoney(cell))
          .filter((value): value is number => value !== undefined);
        const receiptValues = valuesForHeaders(headers, cells, /receipt/);
        const paymentValues = valuesForHeaders(headers, cells, /payment/);
        return {
          ...base,
          ...(kind === 'district_expenditure' ? { districtName: name } : { stateName: name }),
          receipts: receiptValues.at(-1) ?? money.at(-2),
          payments: paymentValues.at(-1) ?? money.at(-1),
        };
      }
      return {
        ...base,
        ...(kind === 'panchayat_profile'
          ? { panchayatName: name }
          : kind === 'asset'
            ? { category: name }
            : { title: name }),
        amount: parseMoney(cells.find((cell) => /[0-9]/.test(cell))),
        description: cells.join(' | '),
      };
    })
    .filter((record): record is EGramRecord => record !== undefined);
}

function valuesForHeaders(headers: string[], cells: string[], pattern: RegExp): number[] {
  return headers
    .map((header, index) => (pattern.test(header) ? parseMoney(cells[index]) : undefined))
    .filter((value): value is number => value !== undefined);
}
