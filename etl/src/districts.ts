import { spawn } from 'node:child_process';
import { createWriteStream, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parsePage } from '../sources/egramswaraj/html.js';

/**
 * Sharded eGramSwaraj crawl driver.
 *
 * A single full-state crawl holds every fetched HTML page in memory and
 * serializes them all at once, which OOMs for Maharashtra (~34k pages). This
 * driver splits the crawl by district: it reads the district links out of the
 * two state reports (R&P + one scheme-wise report) and runs the normal
 * eGramSwaraj ETL once per (district, family) seed. Each run is small and
 * loads its own `ingestion_runs` row, so the DB fills progressively and a
 * crashed run only costs one district. Completed districts are marked in
 * `EGS_MARK_DIR`, making restarts resume instead of re-crawling. Workers run
 * `EGS_CONCURRENCY` at a time (default 3) with per-worker
 * `ETL_EGS_MIN_INTERVAL_MS` politeness.
 *
 * Env: ETL_EGS_CONTACT_EMAIL (required), DATABASE_URL (required for children),
 * EGS_BASE_URL, EGS_RP_STATE, EGS_SCHEME_STATE, EGS_MARK_DIR,
 * EGS_CONCURRENCY, EGS_MAX_PAGES, EGS_MIN_INTERVAL_MS.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const ETL_DIR = join(HERE, '..');
const BASE = process.env.EGS_BASE_URL ?? 'https://egramswaraj.gov.in/';
const R_P_STATE =
  process.env.EGS_RP_STATE ?? 'FileRedirect.jsp?FD=ExpenditureReport2025-2026/27&name=27.html';
const SCHEME_STATE =
  process.env.EGS_SCHEME_STATE ??
  'FileRedirect.jsp?FD=SchemeWiseExpenditureReport2025-2026/3287&name=3287.html';
const MARK_DIR = process.env.EGS_MARK_DIR ?? '/tmp/opencode/egs-districts';
const LOG_DIR = join(MARK_DIR, 'logs');
const DL_DIR = join(MARK_DIR, 'dead-letter');
const CONCURRENCY = Number(process.env.EGS_CONCURRENCY ?? 3);
const MAX_PAGES = process.env.EGS_MAX_PAGES ?? '2500';
const MIN_INTERVAL = process.env.EGS_MIN_INTERVAL_MS ?? '6000';

interface DistrictSeed {
  family: 'rp' | 'scheme';
  url: string;
  key: string;
}

async function fetchStateReport(path: string): Promise<string> {
  const url = new URL(path, BASE).toString();
  const response = await fetch(url, {
    headers: {
      accept: 'text/html,application/xhtml+xml',
      'user-agent': `GramLedger-eGramSwaraj/0.1 (+mailto:${process.env.ETL_EGS_CONTACT_EMAIL ?? 'unknown'})`,
    },
  });
  if (!response.ok) throw new Error(`state report ${url}: HTTP ${response.status}`);
  return await response.text();
}

function districtLinks(html: string, family: 'rp' | 'scheme'): string[] {
  const { tables } = parsePage(html);
  const hrefs = [...new Set(tables.flatMap((table) => table.links.flat()))];
  const clean = (href: string) => href.replace(/\s+/g, '');
  const pattern = family === 'scheme' ? /FD=SchemeWiseExpenditureReport/i : /FD=ExpenditureReport/i;
  return hrefs
    .filter((href) => href.startsWith('FileRedirect.jsp') && pattern.test(href))
    .map((href) => new URL(clean(href), BASE).toString());
}

function nameFrom(url: string): string | undefined {
  return /[?&]name=(\d+)\.html/.exec(url)?.[1];
}

function buildItems(rpHtml: string, schemeHtml: string): DistrictSeed[] {
  const rpLinks = districtLinks(rpHtml, 'rp');
  const schemeLinks = districtLinks(schemeHtml, 'scheme');
  const items: DistrictSeed[] = [];
  for (const url of rpLinks) {
    items.push({ family: 'rp', url, key: `rp-${nameFrom(url) ?? 'x'}` });
  }
  for (const url of schemeLinks) {
    items.push({ family: 'scheme', url, key: `scheme-${nameFrom(url) ?? 'x'}` });
  }
  return items;
}

function runDistrictSeed(item: DistrictSeed): Promise<{ key: string; ok: boolean; code: number }> {
  const { key } = item;
  const mark = join(MARK_DIR, `${key}.ok`);
  if (existsSync(mark)) {
    console.log(`[skip ] ${key} already done`);
    return Promise.resolve({ key, ok: true, code: 0 });
  }
  return new Promise((resolve) => {
    const started = Date.now();
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      ETL_SOURCE: 'egramswaraj',
      ETL_EGS_CONTACT_EMAIL: process.env.ETL_EGS_CONTACT_EMAIL ?? '',
      ETL_EGS_REPORT_URLS: item.url,
      ETL_EGS_MAX_PAGES: MAX_PAGES,
      ETL_EGS_MIN_INTERVAL_MS: MIN_INTERVAL,
      ETL_LOG_LEVEL: 'info',
      ETL_DEAD_LETTER_DIR: join(DL_DIR, key),
    };
    const log = createWriteStream(join(LOG_DIR, `${key}.log`));
    const child = spawn('npx', ['tsx', 'src/cli.ts'], {
      cwd: ETL_DIR,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    child.stdout.pipe(log);
    child.stderr.pipe(log);
    child.on('close', (code) => {
      log.end();
      const ok = code === 0 || code === 2; // success or partial → data loaded
      if (ok) writeFileSync(mark, new Date().toISOString());
      console.log(
        `[${ok ? 'done ' : 'FAIL '}] ${key} code=${code} ${Math.round((Date.now() - started) / 1000)}s`,
      );
      resolve({ key, ok, code: code ?? 1 });
    });
  });
}

async function main(): Promise<number> {
  if (!process.env.ETL_EGS_CONTACT_EMAIL) {
    console.error('ETL_EGS_CONTACT_EMAIL is required');
    return 1;
  }
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is required');
    return 1;
  }
  mkdirSync(LOG_DIR, { recursive: true });
  mkdirSync(DL_DIR, { recursive: true });

  const [rpHtml, schemeHtml] = await Promise.all([
    fetchStateReport(R_P_STATE),
    fetchStateReport(SCHEME_STATE),
  ]);
  const items = buildItems(rpHtml, schemeHtml);
  console.log(
    `[info ] ${items.length} work items (${CONCURRENCY} workers, ${MIN_INTERVAL}ms interval each)`,
  );

  const startedAt = Date.now();
  let next = 0;
  const results: { key: string; ok: boolean; code: number }[] = [];
  async function worker(): Promise<void> {
    while (next < items.length) {
      const item = items[next++]!;
      results.push(await runDistrictSeed(item));
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, items.length) }, () => worker()));

  const ok = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok);
  console.log(
    `[info ] ${ok}/${results.length} districts done, ${failed.length} failed, ${Math.round((Date.now() - startedAt) / 60000)}min elapsed`,
  );
  for (const f of failed) console.warn(`[FAIL ] ${f.key} code=${f.code}`);
  return failed.length === 0 ? 0 : 1;
}

main().then(
  (code) => {
    process.exitCode = code;
  },
  (err) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exitCode = 1;
  },
);
