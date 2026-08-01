import { ETLError } from '../../src/core/errors.js';
import { DEFAULT_RESOURCE_ID, type DataGovInConfig } from './types.js';

export type EnvLike = Record<string, string | undefined>;

/**
 * Loads data.gov.in source config from environment variables.
 *
 * | Variable                   | Default                                        |
 * | -------------------------- | ---------------------------------------------- |
 * | `ETL_DGI_API_KEY`          | (required)                                     |
 * | `ETL_DGI_RESOURCE_ID`      | Agmarknet daily mandi prices resource id       |
 * | `ETL_DGI_STATE`            | (unset = all India)                            |
 * | `ETL_DGI_BASE_URL`         | `https://api.data.gov.in/resource`             |
 * | `ETL_DGI_PAGE_SIZE`        | 1000                                           |
 * | `ETL_DGI_MAX_PAGES`        | 20                                             |
 */
export function loadDataGovInConfig(env: EnvLike = process.env): DataGovInConfig {
  const apiKey = env.ETL_DGI_API_KEY;
  if (!apiKey) {
    throw new ETLError('CONFIG_ERROR', 'ETL_DGI_API_KEY is required for the data.gov.in source');
  }
  return {
    apiKey,
    resourceId: env.ETL_DGI_RESOURCE_ID ?? DEFAULT_RESOURCE_ID,
    state: env.ETL_DGI_STATE?.trim() || undefined,
    baseUrl: env.ETL_DGI_BASE_URL ?? 'https://api.data.gov.in/resource',
    pageSize: positiveInt('ETL_DGI_PAGE_SIZE', 1000, env),
    maxPages: positiveInt('ETL_DGI_MAX_PAGES', 20, env),
  };
}

function positiveInt(name: string, fallback: number, env: EnvLike): number {
  const raw = env[name];
  if (raw === undefined || raw === '') return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) {
    throw new ETLError('CONFIG_ERROR', `data.gov.in config '${name}' must be a positive integer`, {
      details: { name, value: raw },
    });
  }
  return value;
}
