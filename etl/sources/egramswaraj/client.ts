import { ETLError } from '../../src/core/errors.js';
import type { Fetcher, FetchResult } from '../../src/core/types.js';
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
 * BFS crawl of the eGramSwaraj "Receipt and Payment" report family:
 *
 *   state (District wise) → district (Block wise) → block (Village wise) → GP
 *   ("Month Wise Payment and Receipt Statement").
 *
 * Each level page links to the next level via `FileRedirect.jsp` URLs; GP
 * statements are leaves. Fetches are rate-limited (`minIntervalMs`), carry a
 * transparent user agent, and reuse any session cookie. Bounded by
 * `maxPages`. Non-retryable page failures are skipped with a warning; a
 * retryable failure aborts so the pipeline's fetch retry re-runs the crawl.
 */
export function createEGramSwarajFetcher(
  config: EGramSwarajConfig,
  options: CrawlOptions = {},
): Fetcher {
  const fetchFn = options.fetchFn ?? fetch;
  const sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  const state: FetchState = { lastRequestAt: 0, cookie: '' };

  return async (): Promise<FetchResult> => {
    const pages: EGramReportEnvelope[] = [];
    const warnings: string[] = [];
    const queue = config.reportUrls.map((path) => new URL(path, config.baseUrl).toString());
    const visited = new Set<string>();
    let requests = 0;

    while (queue.length > 0 && pages.length < config.maxPages) {
      const url = queue.shift()!;
      if (visited.has(url)) continue;
      visited.add(url);
      try {
        const html = await fetchOne(config, state, url, fetchFn, sleep);
        pages.push({ url, html });
        requests++;
        const level = detectLevel(html);
        for (const child of childLinks(url, html, level)) {
          if (!visited.has(child)) queue.push(child);
        }
      } catch (cause) {
        if (cause instanceof ETLError && cause.retryable) throw cause;
        const detail = cause instanceof Error ? cause.message : String(cause);
        warnings.push(`${url}: ${detail}`);
      }
    }

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
  if (level === 'monthly' || level === 'unknown') return [];
  const { tables } = parsePage(html);
  const hrefs = [...new Set(tables.flatMap((table) => table.links.flat()))];
  const pattern = level === 'village' ? /FD=ExpFY/i : /FD=ExpenditureReport/i;
  return hrefs
    .filter((href) => href.startsWith('FileRedirect.jsp') && pattern.test(href))
    .map((href) => new URL(href, parentUrl).toString());
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
