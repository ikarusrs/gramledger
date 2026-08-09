import { config } from '../../core/config';
import { client } from './client';
import {
  getMockFinance,
  getMockHierarchy,
  getMockPanchayat,
  searchMockPanchayats,
} from './mockData';
import type { Hierarchy, Panchayat, PanchayatDetail, PanchayatFinance, SearchQuery } from './types';

export interface ApiResult<T> {
  data: T;
  isMock: boolean;
}

function describeError(err: unknown): string {
  if (err instanceof Error) return `${err.name}: ${err.message}`;
  return String(err);
}

async function fallible<T>(
  path: string,
  fromJson: (json: unknown) => T,
  mock: () => T,
): Promise<ApiResult<T>> {
  try {
    const json = await client.get<unknown>(path);
    return { data: fromJson(json), isMock: false };
  } catch (err) {
    if (!config.allowMocks) throw err;
    console.warn(`[web] GET ${path} failed (${describeError(err)}); using demo data`);
    return { data: mock(), isMock: true };
  }
}

/** GET /v1/hierarchy — districts → talukas → villages. */
export function getHierarchy(): Promise<ApiResult<Hierarchy>> {
  return fallible('/v1/hierarchy', (j) => j as Hierarchy, getMockHierarchy);
}

/** GET /v1/panchayats?q=&district=&taluka= — search. */
export function searchPanchayats(query: SearchQuery): Promise<ApiResult<Panchayat[]>> {
  const params = new URLSearchParams();
  if (query.q) params.set('q', query.q);
  if (query.districtId != null) params.set('districtId', String(query.districtId));
  if (query.talukaId != null) params.set('talukaId', String(query.talukaId));
  const qs = params.toString();
  const path = `/v1/panchayats${qs ? `?${qs}` : ''}`;
  return fallible(
    path,
    (j) => j as Panchayat[],
    () => searchMockPanchayats(query),
  );
}

/** GET /v1/panchayats/{id} — profile summary. */
export function getPanchayat(id: number): Promise<ApiResult<PanchayatDetail | undefined>> {
  return fallible(
    `/v1/panchayats/${id}`,
    (j) => j as PanchayatDetail,
    () => getMockPanchayat(id),
  );
}

/** GET /v1/panchayats/{id}/finance?fy= — grants + expenditure (+ scheme breakdown). */
export function getPanchayatFinance(id: number, fy?: number): Promise<ApiResult<PanchayatFinance>> {
  const path = `/v1/panchayats/${id}/finance${fy != null ? `?fy=${fy}` : ''}`;
  return fallible(
    path,
    (j) => j as PanchayatFinance,
    () => getMockFinance(id, fy ?? 2024),
  );
}
