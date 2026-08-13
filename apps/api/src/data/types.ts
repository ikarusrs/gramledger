/**
 * /v1 response contract, mirroring `apps/web/src/lib/api/types.ts`. These are
 * the wire shapes the web client consumes; the demo data layer implements them
 * until the Postgres-backed repository lands.
 */

export interface NamedEntity {
  id: number;
  lgdCode: string;
  nameMr: string;
  nameEn: string;
}

export interface Village extends NamedEntity {
  panchayatId: number | null;
}

export interface Taluka extends NamedEntity {
  villages: Village[];
}

export interface District extends NamedEntity {
  talukas: Taluka[];
}

export interface Hierarchy {
  districts: District[];
}

export type PanchayatLevel = 'gram' | 'block' | 'district';

export interface Panchayat extends NamedEntity {
  districtId: number;
  talukaId: number;
  districtNameMr?: string;
  districtNameEn?: string;
  talukaNameMr?: string;
  talukaNameEn?: string;
  level: PanchayatLevel;
}

export interface ElectedMember {
  role: string;
  name: string;
}

export interface PanchayatProfile {
  sarpanchName: string | null;
  secretaryName: string | null;
  contactPhone: string | null;
  electedCommittee: ElectedMember[] | null;
  updatedAt: string | null;
}

export interface PanchayatDetail extends Panchayat {
  profile: PanchayatProfile;
}

export interface Scheme extends NamedEntity {
  code: string;
  ministry: string | null;
}

export interface GrantRow {
  scheme: Scheme;
  amount: number;
  source: string;
  disbursedAt: string | null;
}

export interface ExpenditureRow {
  scheme: Scheme;
  head: string;
  amount: number;
}

export interface SchemeSummary {
  scheme: Scheme;
  grants: number;
  expenditure: number;
}

export interface FinanceSummary {
  totalGrants: number;
  totalExpenditure: number;
  balance: number;
  byScheme: SchemeSummary[];
  grants: GrantRow[];
  expenditures: ExpenditureRow[];
}

export interface PanchayatFinance {
  fy: number;
  availableFys: number[];
  summary: FinanceSummary;
}

export interface SearchQuery {
  q?: string;
  districtId?: number;
  talukaId?: number;
}
