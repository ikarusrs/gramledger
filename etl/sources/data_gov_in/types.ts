import type { ETLRecord } from '../../src/core/types.js';

/** data.gov.in resource id for the Agmarknet daily mandi price dataset. */
export const DEFAULT_RESOURCE_ID = '9ef84268-d588-465a-a308-a864a43d0070';

/** A raw record as served by the data.gov.in API. */
export interface RawApiRecord extends ETLRecord {
  state?: string;
  district?: string;
  market?: string;
  commodity?: string;
  variety?: string;
  grade?: string;
  arrival_date?: string;
  min_price?: unknown;
  max_price?: unknown;
  modal_price?: unknown;
}

/**
 * A record flowing between pipeline stages. `districtLgdCode` is absent after
 * parse and is set by the validate stage (via the district resolver); the load
 * stage maps it onto `district_lgd_code` in `commodity_prices`.
 */
export interface MandiPriceRecord extends ETLRecord {
  state: string;
  district: string;
  market: string;
  commodity: string;
  variety: string;
  grade: string;
  /** ISO `YYYY-MM-DD` arrival date. */
  priceDate: string;
  /** Prices in INR per quintal, as reported by Agmarknet. */
  minPrice: number;
  maxPrice: number;
  modalPrice: number;
  districtLgdCode?: number;
}

/** Source configuration; see `config.ts` for env loading. */
export interface DataGovInConfig {
  /** data.gov.in API key (free, from data.gov.in › My Account). */
  apiKey: string;
  /** Resource id; defaults to the Agmarknet daily mandi prices dataset. */
  resourceId: string;
  /** Optional exact state name; narrows the API query (e.g. `Maharashtra`). */
  state?: string;
  /** API base URL; points at `/resource/{id}`. Overridable for tests/proxies. */
  baseUrl: string;
  /** Records per API page (the platform caps this at 1000). */
  pageSize: number;
  /** Guard against runaway pagination: pages fetched per run at most. */
  maxPages: number;
}

/**
 * Resolves district names (lowercased) to LGD codes. Backed by the `districts`
 * table in production; injectable for tests.
 */
export type DistrictResolver = (names: string[]) => Promise<Map<string, number>>;
