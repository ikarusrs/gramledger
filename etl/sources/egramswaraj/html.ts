import { parse, type HTMLElement } from 'node-html-parser';

/**
 * eGramSwaraj HTML report pages are iText-generated HTML where every cell
 * carries `rowspan="2"` and the second row of each pair is empty. Iterating
 * the real `<tr>` elements (and skipping empty rows) therefore yields an
 * accurate matrix with no manual rowspan/colspan expansion needed.
 */

export type ReportLevel = 'district' | 'block' | 'village' | 'monthly' | 'unknown';

export interface HtmlTable {
  headers: string[];
  rows: string[][];
  /** `FileRedirect.jsp?…` hrefs per row (aligns with `rows`). */
  links: string[][];
}

export interface ParsedPage {
  tables: HtmlTable[];
  level: ReportLevel;
}

/** Parses a whole report page into tables plus a report-level classification. */
export function parsePage(html: string): ParsedPage {
  const root = parse(html);
  return {
    tables: root.querySelectorAll('table').map(extractTable),
    level: detectLevel(root.text),
  };
}

function extractTable(table: HTMLElement): HtmlTable {
  const rows: string[][] = [];
  const links: string[][] = [];
  for (const tr of table.querySelectorAll('tr')) {
    const cells: string[] = [];
    for (const cell of tr.querySelectorAll('th,td')) {
      cells.push(cleanText(cell.text));
    }
    if (!cells.some((cell) => cell)) continue;
    rows.push(cells);
    links.push(
      tr
        .querySelectorAll('a')
        .map((a) => a.getAttribute('href'))
        .filter((href): href is string => Boolean(href)),
    );
  }
  const headerIndex = rows.findIndex((row) =>
    row.some((cell) =>
      /^(month|district|block|village panchayat|panchayat|state|receipts?|payments?|ob )/i.test(
        cell,
      ),
    ),
  );
  return { headers: headerIndex >= 0 ? (rows[headerIndex] ?? []) : [], rows, links };
}

export function detectLevel(text: string): ReportLevel {
  if (/month wise payment and receipt statement/i.test(text)) return 'monthly';
  if (/district wise receipt and payment statement/i.test(text)) return 'district';
  if (/block wise receipt and payment statement/i.test(text)) return 'block';
  if (/village wise receipt and payment statement/i.test(text)) return 'village';
  return 'unknown';
}

/** Fiscal-year month number (April = 1 … March = 12), tolerating label typos. */
export function monthFromLabel(value: string): number | undefined {
  const word = value.split(/[\s,]/)[0]?.toLowerCase().slice(0, 3);
  if (!word) return undefined;
  const byPrefix: Record<string, number> = {
    apr: 1,
    may: 2,
    jun: 3,
    jul: 4,
    aug: 5,
    sep: 6,
    oct: 7,
    nov: 8,
    dec: 9,
    jan: 10,
    feb: 11,
    mar: 12,
  };
  return byPrefix[word];
}

export function normalizeHeader(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Parses Indian-format money ("27,37,064.11" → 2737064.11). */
export function parseMoney(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const cleaned = value.replace(/[^0-9.-]/g, '');
  if (!cleaned) return undefined;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function parseFinancialYear(value: string): number | undefined {
  const match = /\b(20\d{2})\s*[-/]\s*20\d{2}\b/.exec(value);
  return match ? Number(match[1]) : undefined;
}

export function cleanText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}
