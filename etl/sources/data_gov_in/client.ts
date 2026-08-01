import { ETLError } from '../../src/core/errors.js';
import type { Fetcher, FetchResult } from '../../src/core/types.js';
import type { DataGovInConfig, RawApiRecord } from './types.js';

/** A single page from the data.gov.in API envelope. */
export interface ApiPage {
  records: RawApiRecord[];
  /** Total matching records across all pages (from the envelope). */
  total: number;
  /** Records returned in this page. */
  count: number;
}

const DEFAULT_BASE_URL = 'https://api.data.gov.in/resource';

/** Builds the paginated resource URL for `offset`. */
export function buildResourceUrl(
  config: Pick<DataGovInConfig, 'baseUrl' | 'resourceId' | 'apiKey' | 'state' | 'pageSize'>,
  offset: number,
): string {
  const params = new URLSearchParams({
    'api-key': config.apiKey,
    format: 'json',
    limit: String(config.pageSize ?? 1000),
    offset: String(offset),
  });
  if (config.state) params.set('filters[state]', config.state);
  return `${config.baseUrl}/${config.resourceId}?${params.toString()}`;
}

/**
 * Fetches one page and returns its records. Non-2xx responses, empty bodies
 * and invalid JSON are treated as transient (`retryable`) — the pipeline retries
 * the whole fetch stage. A well-formed but unexpected envelope is a permanent
 * error and aborts the run.
 */
export async function fetchDataGovInPage(
  config: Pick<DataGovInConfig, 'baseUrl' | 'resourceId' | 'apiKey' | 'state' | 'pageSize'>,
  offset: number,
  fetchFn: typeof fetch = fetch,
): Promise<ApiPage> {
  const url = buildResourceUrl(config, offset);
  const response = await fetchFn(url, { headers: { accept: 'application/json' } });
  if (!response.ok) {
    throw new ETLError('FETCH_ERROR', `data.gov.in returned HTTP ${response.status}`, {
      retryable: true,
      details: { url, status: response.status },
    });
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch (cause) {
    throw new ETLError('FETCH_ERROR', 'data.gov.in returned invalid JSON', {
      retryable: true,
      cause,
      details: { url },
    });
  }

  const envelope = body as { status?: string; records?: unknown; total?: unknown; count?: unknown };
  if (envelope.status !== 'ok' || !Array.isArray(envelope.records)) {
    throw new ETLError('FETCH_ERROR', 'data.gov.in returned an unexpected response envelope', {
      details: { url, status: envelope.status },
    });
  }
  return {
    records: envelope.records as RawApiRecord[],
    total: Number(envelope.total ?? 0),
    count: envelope.records.length,
  };
}

/**
 * Fetch stage: walks the dataset page by page (`offset` pagination) and returns
 * all raw records serialized as JSON. The page window is bounded by
 * `config.maxPages`; records fetched so far still load, and the fetch metadata
 * flags when the window truncated the dataset.
 */
export function createFetcher(config: DataGovInConfig, fetchFn: typeof fetch = fetch): Fetcher {
  return async (): Promise<FetchResult> => {
    const baseUrl = config.baseUrl || DEFAULT_BASE_URL;
    const pagesConfig = { ...config, baseUrl };
    const records: RawApiRecord[] = [];
    let offset = 0;
    let pages = 0;
    let total = Infinity;
    let truncated = false;

    while (offset < total && pages < config.maxPages) {
      const page = await fetchDataGovInPage(pagesConfig, offset, fetchFn);
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
      url: buildResourceUrl(config, 0),
      fetchedAt,
      resourceId: config.resourceId,
      total,
      pages,
      truncated,
      state: config.state,
    };
    return { content: JSON.stringify({ records, total, pages }), meta };
  };
}
