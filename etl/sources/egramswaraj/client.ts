import { ETLError } from '../../src/core/errors.js';
import type { Fetcher, FetchResult } from '../../src/core/types.js';
import type { EGramSwarajConfig, EGramReportEnvelope } from './types.js';

export interface FetchOptions {
  fetchFn?: typeof fetch;
  sleep?: (milliseconds: number) => Promise<void>;
}

export function createEGramSwarajFetcher(
  config: EGramSwarajConfig,
  options: FetchOptions = {},
): Fetcher {
  const fetchFn = options.fetchFn ?? fetch;
  const sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  let lastRequestAt = 0;
  let cookie = '';

  return async (): Promise<FetchResult> => {
    const pages: EGramReportEnvelope[] = [];
    const urls = config.reportUrls.slice(0, config.maxPages);
    for (const path of urls) {
      const now = Date.now();
      const wait = config.minIntervalMs - (now - lastRequestAt);
      if (wait > 0) await sleep(wait);
      const url = new URL(path, config.baseUrl).toString();
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), config.timeoutMs);
      try {
        const response = await fetchFn(url, {
          headers: {
            accept: 'text/html,application/xhtml+xml',
            'user-agent': config.userAgent,
            ...(cookie ? { cookie } : {}),
          },
          signal: controller.signal,
        });
        lastRequestAt = Date.now();
        if (!response.ok) {
          throw new ETLError('FETCH_ERROR', `eGramSwaraj returned HTTP ${response.status}`, {
            retryable: response.status >= 500 || response.status === 429,
            details: { url, status: response.status },
          });
        }
        const setCookie = response.headers.get('set-cookie');
        if (setCookie) cookie = setCookie.split(';', 1)[0] ?? cookie;
        const html = await response.text();
        if (!/<html|<table/i.test(html)) {
          throw new ETLError('PARSE_ERROR', 'eGramSwaraj response is not recognizable HTML', {
            details: { url },
          });
        }
        pages.push({ url, html });
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
    return {
      content: JSON.stringify(pages),
      meta: {
        fetchedAt: new Date().toISOString(),
        url: new URL(urls[0] ?? '', config.baseUrl).toString(),
        pages: pages.length,
        requests: pages.length,
      },
    };
  };
}
