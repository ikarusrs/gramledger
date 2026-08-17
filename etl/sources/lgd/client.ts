import { ETLError } from '../../src/core/errors.js';
import type { Fetcher, FetchResult } from '../../src/core/types.js';
import type { LgdConfig, RawLgdRecord } from './types.js';

/** A single page from the CKAN `datastore_search` envelope. */
export interface LgdPage {
  records: RawLgdRecord[];
  /** Total matching records across all pages (from the envelope). */
  total: number;
  /** Records returned in this page. */
  count: number;
}

/** The config fields involved in building a `datastore_search` URL. */
type SearchConfig = Pick<LgdConfig, 'baseUrl' | 'resourceId' | 'pageSize' | 'stateCode'>;

/** Builds the paginated `datastore_search` URL for `offset`. */
export function buildSearchUrl(config: SearchConfig, offset: number): string {
  const params = new URLSearchParams({
    resource_id: config.resourceId,
    limit: String(config.pageSize),
    offset: String(offset),
  });
  if (config.stateCode !== undefined) {
    params.set('filters', JSON.stringify({ state_code: String(config.stateCode) }));
  }
  return `${config.baseUrl}?${params.toString()}`;
}

/**
 * Fetches one page and returns its records. Non-2xx responses, empty bodies
 * and invalid JSON are treated as transient (`retryable`) — the pipeline retries
 * the whole fetch stage. A well-formed but unexpected envelope (`success: false`
 * or missing `records`) is a permanent error and aborts the run.
 */
export async function fetchLgdPage(
  config: SearchConfig,
  offset: number,
  fetchFn: typeof fetch = fetch,
): Promise<LgdPage> {
  const url = buildSearchUrl(config, offset);
  const response = await fetchFn(url, { headers: { accept: 'application/json' } });
  if (!response.ok) {
    throw new ETLError('FETCH_ERROR', `LGD portal returned HTTP ${response.status}`, {
      retryable: true,
      details: { url, status: response.status },
    });
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch (cause) {
    throw new ETLError('FETCH_ERROR', 'LGD portal returned invalid JSON', {
      retryable: true,
      cause,
      details: { url },
    });
  }

  const envelope = body as {
    success?: boolean;
    result?: { records?: unknown; total?: unknown };
  };
  if (envelope.success !== true || !Array.isArray(envelope.result?.records)) {
    throw new ETLError('FETCH_ERROR', 'LGD portal returned an unexpected response envelope', {
      details: { url },
    });
  }
  return {
    records: envelope.result.records as RawLgdRecord[],
    total: Number(envelope.result.total ?? 0),
    count: envelope.result.records.length,
  };
}

/**
 * Fetch stage: walks the dataset page by page (`offset` pagination) and returns
 * all raw records serialized as JSON. The page window is bounded by
 * `config.maxPages`; records fetched so far still load, and the fetch metadata
 * flags when the window truncated the dataset.
 */
export function createFetcher(config: LgdConfig, fetchFn: typeof fetch = fetch): Fetcher {
  return async (): Promise<FetchResult> => {
    const records: RawLgdRecord[] = [];
    let offset = 0;
    let pages = 0;
    let total = Infinity;
    let truncated = false;

    while (offset < total && pages < config.maxPages) {
      const page = await fetchLgdPage(config, offset, fetchFn);
      records.push(...page.records);
      offset += page.count;
      total = page.total;
      pages += 1;
      if (page.count === 0) break;
      if (offset >= total) break;
      if (pages >= config.maxPages) truncated = true;
    }

    const fetchedAt = new Date().toISOString();
    const meta = {
      url: buildSearchUrl(config, 0),
      fetchedAt,
      resourceId: config.resourceId,
      total,
      pages,
      truncated,
    };
    return { content: JSON.stringify({ records, total, pages }), meta };
  };
}
