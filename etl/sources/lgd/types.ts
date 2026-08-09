import type { ETLRecord } from '../../src/core/types.js';

/** Panchayat tier; mirrors the `panchayats.level` CHECK constraint. */
export type PanchayatLevel = 'gram' | 'block' | 'district';

/**
 * A raw record as served by the LGD village→Gram Panchayat mapping dataset.
 * The portal publishes the full administrative chain on every row, so one
 * source file populates every hierarchy table. Unmapped villages carry
 * `'None'`/null local-body fields.
 */
export interface RawLgdRecord extends ETLRecord {
  village_name?: string;
  village_code?: string;
  local_body_name?: string | null;
  local_body_type?: string | null;
  local_body_code?: string | null;
  sub_district_name?: string;
  sub_district_code?: string;
  district_name?: string;
  district_code?: string;
  state_name?: string;
  state_code?: string;
}

/**
 * A record flowing between pipeline stages: one row = one village with its
 * full chain (state → district → sub-district/taluka → Gram Panchayat). The
 * load stage fans these out into the five hierarchy tables in FK order.
 */
export interface LgdRow extends ETLRecord {
  stateCode: number;
  stateName: string;
  districtCode: number;
  districtName: string;
  /** LGD calls the third layer "sub-district"; the app stores it as taluka. */
  talukCode: number;
  talukName: string;
  /** Absent when the village is not (yet) mapped to any Gram Panchayat. */
  panchayatCode: number | null;
  panchayatName: string | null;
  panchayatLevel: PanchayatLevel;
  villageCode: number;
  villageName: string;
}

/** Source configuration; see `config.ts` for env loading. */
export interface LgdConfig {
  /** CKAN `datastore_search` endpoint the resource is served from. */
  baseUrl: string;
  /** Resource id of the LGD village→GP mapping dataset. */
  resourceId: string;
  /** Records per API page. */
  pageSize: number;
  /** Guard against runaway pagination: pages fetched per run at most. */
  maxPages: number;
}
