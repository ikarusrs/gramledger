import { ETLError } from '../../src/core/errors.js';
import type { LgdConfig } from './types.js';

export type EnvLike = Record<string, string | undefined>;

/**
 * Loads LGD source config from environment variables.
 *
 * | Variable               | Default                                             |
 * | ---------------------- | --------------------------------------------------- |
 * | `ETL_LGD_BASE_URL`     | `https://ckandev.indiadataportal.com/api/3/action/datastore_search` |
 * | `ETL_LGD_RESOURCE_ID`  | (required)                                          |
 * | `ETL_LGD_PAGE_SIZE`    | 1000                                                |
 * | `ETL_LGD_MAX_PAGES`    | 20                                                  |
 * | `ETL_LGD_STATE_CODE`   | (optional) — fetch only this LGD state (e.g. 27)    |
 */
export function loadLgdConfig(env: EnvLike = process.env): LgdConfig {
  const resourceId = env.ETL_LGD_RESOURCE_ID?.trim();
  if (!resourceId) {
    throw new ETLError('CONFIG_ERROR', 'ETL_LGD_RESOURCE_ID is required for the LGD source');
  }
  const config: LgdConfig = {
    baseUrl:
      env.ETL_LGD_BASE_URL ?? 'https://ckandev.indiadataportal.com/api/3/action/datastore_search',
    resourceId,
    pageSize: positiveInt('ETL_LGD_PAGE_SIZE', 1000, env),
    maxPages: positiveInt('ETL_LGD_MAX_PAGES', 20, env),
  };
  if (env.ETL_LGD_STATE_CODE?.trim()) {
    config.stateCode = positiveInt('ETL_LGD_STATE_CODE', 0, env);
  }
  return config;
}

function positiveInt(name: string, fallback: number, env: EnvLike): number {
  const raw = env[name];
  if (raw === undefined || raw === '') return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) {
    throw new ETLError('CONFIG_ERROR', `LGD config '${name}' must be a positive integer`, {
      details: { name, value: raw },
    });
  }
  return value;
}
