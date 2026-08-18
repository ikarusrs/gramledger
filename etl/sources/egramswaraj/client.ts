import { ETLError } from '../../src/core/errors.js';
import { withRetry } from '../../src/core/retry.js';
import type { Fetcher, FetchResult, StageContext } from '../../src/core/types.js';
import { detectLevel, parsePage, type ReportLevel } from './html.js';
import type { EGramReportEnvelope, EGramSwarajConfig } from './types.js';

export interface CrawlOptions {
  fetchFn?: typeof fetch;
  sleep?: (milliseconds: number) => Promise<void>;
}

interface FetchState {
  lastRequestAt: number;
  cookie: string;
}

/**
 * BFS crawl of the eGramSwaraj report families:
 *
 *   R&P: state (District wise) → district (Block wise) → block (Village wise)
 *        → GP ("Month Wise Payment and Receipt Statement").
 *   Scheme-wise: scheme state → scheme district → block (`blockWiseSummaryReport.do`)
 *        → village (`schemeWiseVillageReport.do`, per-GP leaf rows).
 *
 * Each level page links to the next via `FileRedirect.jsp` URLs (R&P) or
 * `.do` pages (scheme); GP statements and scheme village pages are leaves.
 * Fetches are rate-limited (`minIntervalMs`), carry a transparent user agent,
 * and reuse any session cookie. Bounded by `maxPages`. Every page is retried
 * with backoff (core retry config); a page that exhausts its retries is skipped
 * with a warning so one flaky page cannot void an entire crawl. A retryable
 * failure before any page has been fetched is a real outage and aborts so the
 * pipeline's fetch retry restarts the crawl. Progress is logged every 50 pages.
 */
export function createEGramSwarajFetcher(
  config: EGramSwarajConfig,
  options: CrawlOptions = {},
): Fetcher {
  const fetchFn = options.fetchFn ?? fetch;
  const sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  const state: FetchState = { lastRequestAt: 0, cookie: '' };

  return async (ctx: StageContext): Promise<FetchResult> => {
    const pages: EGramReportEnvelope[] = [];
    const warnings: string[] = [];
    const queue = config.reportUrls.map((path) => new URL(path, config.baseUrl).toString());
    const visited = new Set<string>();
    let requests = 0;

    while (queue.length > 0 && pages.length < config.maxPages) {
      const url = queue.shift()!;
      if (visited.has(url)) continue;
      visited.add(url);
      let html: string;
      try {
        html = await withRetry(() => fetchOne(config, state, url, fetchFn, sleep), {
          attempts: ctx.config.retry.attempts,
          baseBackoffMs: ctx.config.retry.baseBackoffMs,
          maxBackoffMs: ctx.config.retry.maxBackoffMs,
        });
      } catch (cause) {
        const detail = cause instanceof Error ? cause.message : String(cause);
        if (cause instanceof ETLError && cause.retryable && pages.length === 0 && requests === 0) {
          throw cause;
        }
        warnings.push(`${url}: ${detail}`);
        ctx.log.warn('egramswaraj: skipping page after retries', { url, error: detail });
        ctx.metrics.increment('fetch.pages_skipped');
        continue;
      }
      pages.push({ url, html });
      requests++;
      ctx.metrics.increment('fetch.pages');
      const level = detectLevel(html);
      for (const child of childLinks(url, html, level)) {
        if (!visited.has(child)) queue.push(child);
      }
      if (pages.length % 50 === 0) {
        ctx.log.info('egramswaraj crawl progress', {
          pages: pages.length,
          requests,
          queueDepth: queue.length,
        });
      }
    }

    ctx.log.info('egramswaraj crawl complete', {
      pages: pages.length,
      requests,
      warnings: warnings.length,
    });
    return {
      content: JSON.stringify(pages),
      meta: {
        fetchedAt: new Date().toISOString(),
        url: queue[0] ?? config.reportUrls[0],
        pages: pages.length,
        requests,
        warnings,
      },
    };
  };
}

function childLinks(parentUrl: string, html: string, level: ReportLevel): string[] {
  if (level === 'monthly' || level === 'scheme_village' || level === 'unknown') return [];
  const { tables } = parsePage(html);
  const hrefs = [...new Set(tables.flatMap((table) => table.links.flat()))];
  const clean = (href: string) => href.replace(/\s+/g, '');
  const asUrl = (href: string) => {
    try {
      return new URL(clean(href), parentUrl).toString();
    } catch {
      return undefined;
    }
  };
  let pattern: RegExp;
  let relative: RegExp | undefined;
  switch (level) {
    case 'scheme_state':
      pattern = /FD=SchemeWiseExpenditureReport/i;
      break;
    case 'scheme_district':
      relative = /^blockWiseSummaryReport\.do/i;
      pattern = /^$/;
      break;
    case 'scheme_block':
      relative = /^schemeWiseVillageReport\.do/i;
      pattern = /^$/;
      break;
    case 'village':
      pattern = /FD=ExpFY/i;
      break;
    default:
      pattern = /FD=ExpenditureReport/i;
  }
  const out: string[] = [];
  for (const href of hrefs) {
    const cleaned = clean(href);
    const keep = relative
      ? relative.test(cleaned)
      : href.startsWith('FileRedirect.jsp') && pattern.test(href);
    if (!keep) continue;
    const url = asUrl(href);
    if (url) out.push(url);
  }
  return out;
}

async function fetchOne(
  config: EGramSwarajConfig,
  state: FetchState,
  url: string,
  fetchFn: typeof fetch,
  sleep: (ms: number) => Promise<void>,
): Promise<string> {
  const now = Date.now();
  const wait = config.minIntervalMs - (now - state.lastRequestAt);
  if (wait > 0) await sleep(wait);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.timeoutMs);
  try {
    const response = await fetchFn(url, {
      headers: {
        accept: 'text/html,application/xhtml+xml',
        'user-agent': config.userAgent,
        ...(state.cookie ? { cookie: state.cookie } : {}),
      },
      signal: controller.signal,
    });
    state.lastRequestAt = Date.now();
    if (!response.ok) {
      throw new ETLError('FETCH_ERROR', `eGramSwaraj returned HTTP ${response.status}`, {
        retryable: response.status >= 500 || response.status === 429,
        details: { url, status: response.status },
      });
    }
    const setCookie = response.headers.get('set-cookie');
    if (setCookie) state.cookie = setCookie.split(';', 1)[0] ?? state.cookie;
    const html = await response.text();
    if (/File does not exist|sessexpire/i.test(html)) {
      throw new ETLError('PARSE_ERROR', 'eGramSwaraj reported a missing report file', {
        details: { url },
      });
    }
    if (!/<html|<table/i.test(html)) {
      throw new ETLError('PARSE_ERROR', 'eGramSwaraj response is not recognizable HTML', {
        details: { url },
      });
    }
    return html;
  } catch (cause) {
    if (cause instanceof ETLError) throw cause;
    throw new ETLError('FETCH_ERROR', `eGramSwaraj request failed for ${url}`, {
      retryable: true,
      cause,
    });
  } finally {
    clearTimeout(timer);
  }
}
