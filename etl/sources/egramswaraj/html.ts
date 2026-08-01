export interface HtmlTable {
  headers: string[];
  rows: string[][];
  links: string[][];
}

export function extractTables(html: string): HtmlTable[] {
  return [...html.matchAll(/<table\b[^>]*>([\s\S]*?)<\/table>/gi)].map((match) => {
    const table = match[1] ?? '';
    const rows = [...table.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map((row) => {
      const cells = [...(row[1] ?? '').matchAll(/<t[hd]\b[^>]*>([\s\S]*?)<\/t[hd]>/gi)];
      return cells.map((cell) => cleanText(cell[1] ?? ''));
    });
    const links = [...table.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map((row) =>
      [...(row[1] ?? '').matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>/gi)].map(
        (link) => link[1] ?? '',
      ),
    );
    const headerIndex = rows.findIndex((row) =>
      row.some((cell) => /district|state|panchayat|payment|expenditure|asset|activity/i.test(cell)),
    );
    const dataStart = rows.findIndex(
      (row, index) =>
        index > headerIndex && row.some((cell) => /[A-Za-z]/.test(cell)) && !isHeaderLike(row),
    );
    const headerRows = rows.slice(
      headerIndex >= 0 ? headerIndex : 0,
      dataStart >= 0 ? dataStart : undefined,
    );
    const headers = headerRows.sort((a, b) => b.length - a.length)[0] ?? [];
    return {
      headers,
      rows:
        dataStart >= 0
          ? rows.slice(dataStart)
          : headerIndex >= 0
            ? rows.slice(headerIndex + 1)
            : rows,
      links:
        dataStart >= 0
          ? links.slice(dataStart)
          : headerIndex >= 0
            ? links.slice(headerIndex + 1)
            : links,
    };
  });
}

function isHeaderLike(row: string[]): boolean {
  const text = row.join(' ').toLowerCase();
  return /zilla|block|village|receipt|payment|panchayat|state|district|ob \+/.test(text);
}

export function normalizeHeader(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

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
  return value
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}
