/**
 * Demo fixtures mirroring database/seeds/hierarchy_sample.sql plus fabricated
 * finance rows. Used until the /v1 endpoints are implemented.
 */
import type {
  Hierarchy,
  Panchayat,
  PanchayatDetail,
  PanchayatFinance,
  PanchayatLevel,
  PanchayatProfile,
  Scheme,
  SearchQuery,
} from './types';

export const mockSchemes: Scheme[] = [
  {
    id: 1,
    code: '15FC',
    nameMr: 'पंधरावा वित्त आयोग अनुदान',
    nameEn: '15th Finance Commission Grant',
    lgdCode: '',
    ministry: 'Panchayati Raj',
  },
  {
    id: 2,
    code: 'MGNREGA',
    nameMr: 'महात्मा गांधी राष्ट्रीय ग्रामीण रोजगार हमी योजना',
    nameEn: 'MGNREGA',
    lgdCode: '',
    ministry: 'Rural Development',
  },
  {
    id: 3,
    code: 'SBM-G',
    nameMr: 'स्वच्छ भारत मिशन (ग्रामीण)',
    nameEn: 'Swachh Bharat Mission (Gramin)',
    lgdCode: '',
    ministry: 'Jal Shakti',
  },
  {
    id: 4,
    code: 'PMAY-G',
    nameMr: 'प्रधानमंत्री आवास योजना (ग्रामीण)',
    nameEn: 'PMAY-G',
    lgdCode: '',
    ministry: 'Rural Development',
  },
  {
    id: 5,
    code: 'RKVY',
    nameMr: 'राष्ट्रीय कृषी विकास योजना',
    nameEn: 'Rashtriya Krishi Vikas Yojana',
    lgdCode: '',
    ministry: 'Agriculture',
  },
];

const h = (
  id: number,
  lgdCode: string,
  nameMr: string,
  nameEn: string,
  districtId: number,
  talukaId: number,
  level: PanchayatLevel = 'gram',
): Panchayat => ({ id, lgdCode, nameMr, nameEn, districtId, talukaId, level });

export const mockPanchayats: Panchayat[] = [
  h(101, '270010101', 'वडगाव बुद्रुक', 'Wadgaon Budruk', 1, 101),
  h(102, '270010201', 'तळेगाव', 'Talegaon', 1, 102),
  h(103, '270020101', 'रहिमतपूर', 'Rahimatpur', 2, 201),
  h(104, '270020102', 'वाठार', 'Vathar', 2, 201),
  h(105, '270020201', 'उंब्रज', 'Umbraj', 2, 202),
  h(106, '270030101', 'रामटेक', 'Ramtek', 3, 301),
  h(107, '270040201', 'निफाड', 'Niphad', 4, 401),
  h(108, '270050101', 'करवीर', 'Karveer', 5, 501),
];

const withLocation = (p: Panchayat): Panchayat => {
  const district = mockHierarchy.districts.find((d) => d.id === p.districtId);
  const taluka = district?.talukas.find((t) => t.id === p.talukaId);
  return {
    ...p,
    districtNameMr: district?.nameMr,
    districtNameEn: district?.nameEn,
    talukaNameMr: taluka?.nameMr,
    talukaNameEn: taluka?.nameEn,
  };
};

export const mockHierarchy: Hierarchy = {
  districts: [
    {
      id: 1,
      lgdCode: '27001',
      nameMr: 'पुणे',
      nameEn: 'Pune',
      talukas: [
        {
          id: 101,
          lgdCode: '2700101',
          nameMr: 'हवेली',
          nameEn: 'Haveli',
          villages: [
            {
              id: 1,
              lgdCode: '27001010101',
              nameMr: 'वडगाव बुद्रुक',
              nameEn: 'Wadgaon Budruk',
              panchayatId: 101,
            },
            { id: 2, lgdCode: '27001010102', nameMr: 'शिवणे', nameEn: 'Shivane', panchayatId: 101 },
          ],
        },
        {
          id: 102,
          lgdCode: '2700102',
          nameMr: 'मावळ',
          nameEn: 'Maval',
          villages: [
            {
              id: 3,
              lgdCode: '27001020101',
              nameMr: 'तळेगाव',
              nameEn: 'Talegaon',
              panchayatId: 102,
            },
            { id: 4, lgdCode: '27001020102', nameMr: 'वडगाव', nameEn: 'Vadgaon', panchayatId: 102 },
          ],
        },
      ],
    },
    {
      id: 2,
      lgdCode: '27002',
      nameMr: 'सातारा',
      nameEn: 'Satara',
      talukas: [
        {
          id: 201,
          lgdCode: '2700201',
          nameMr: 'सातारा',
          nameEn: 'Satara',
          villages: [
            {
              id: 5,
              lgdCode: '27002010101',
              nameMr: 'रहिमतपूर',
              nameEn: 'Rahimatpur',
              panchayatId: 103,
            },
            { id: 6, lgdCode: '27002010201', nameMr: 'वाठार', nameEn: 'Vathar', panchayatId: 104 },
          ],
        },
        {
          id: 202,
          lgdCode: '2700202',
          nameMr: 'कराड',
          nameEn: 'Karad',
          villages: [
            { id: 7, lgdCode: '27002020101', nameMr: 'उंब्रज', nameEn: 'Umbraj', panchayatId: 105 },
          ],
        },
      ],
    },
    {
      id: 3,
      lgdCode: '27003',
      nameMr: 'नागपूर',
      nameEn: 'Nagpur',
      talukas: [
        {
          id: 301,
          lgdCode: '2700301',
          nameMr: 'रामटेक',
          nameEn: 'Ramtek',
          villages: [
            { id: 8, lgdCode: '27003010101', nameMr: 'रामटेक', nameEn: 'Ramtek', panchayatId: 106 },
          ],
        },
      ],
    },
    {
      id: 4,
      lgdCode: '27004',
      nameMr: 'नाशिक',
      nameEn: 'Nashik',
      talukas: [
        {
          id: 401,
          lgdCode: '2700402',
          nameMr: 'निफाड',
          nameEn: 'Niphad',
          villages: [
            { id: 9, lgdCode: '27004020101', nameMr: 'निफाड', nameEn: 'Niphad', panchayatId: 107 },
          ],
        },
      ],
    },
    {
      id: 5,
      lgdCode: '27005',
      nameMr: 'कोल्हापूर',
      nameEn: 'Kolhapur',
      talukas: [
        {
          id: 501,
          lgdCode: '2700501',
          nameMr: 'करवीर',
          nameEn: 'Karveer',
          villages: [
            {
              id: 10,
              lgdCode: '27005010101',
              nameMr: 'करवीर',
              nameEn: 'Karveer',
              panchayatId: 108,
            },
          ],
        },
      ],
    },
  ],
};

const profiles: Record<number, PanchayatProfile> = {
  101: {
    sarpanchName: 'सुनील पवार',
    secretaryName: 'अनिल देशमुख',
    contactPhone: '9876543210',
    electedCommittee: [
      { role: 'सरपंच', name: 'सुनील पवार' },
      { role: 'उपसरपंच', name: 'स्मिता जाधव' },
      { role: 'सदस्य', name: 'रमेश कदम' },
    ],
    updatedAt: '2026-01-12T09:30:00Z',
  },
  102: {
    sarpanchName: 'संगीता मोरे',
    secretaryName: 'नितीन शिंदे',
    contactPhone: '9822011223',
    electedCommittee: [
      { role: 'सरपंच', name: 'संगीता मोरे' },
      { role: 'उपसरपंच', name: 'विजय पाटील' },
    ],
    updatedAt: '2025-11-03T11:00:00Z',
  },
  103: {
    sarpanchName: 'दत्ता साळुंखे',
    secretaryName: 'शरद कुलकर्णी',
    contactPhone: '9765000011',
    electedCommittee: [
      { role: 'सरपंच', name: 'दत्ता साळुंखे' },
      { role: 'उपसरपंच', name: 'कल्पना सुर्वे' },
    ],
    updatedAt: '2025-10-20T08:45:00Z',
  },
  104: {
    sarpanchName: 'मंगल जाधव',
    secretaryName: 'प्रकाश मोहिते',
    contactPhone: null,
    electedCommittee: null,
    updatedAt: '2025-09-15T10:20:00Z',
  },
  105: {
    sarpanchName: 'बाळासाहेब चव्हाण',
    secretaryName: 'विनायक गायकवाड',
    contactPhone: '9860111222',
    electedCommittee: null,
    updatedAt: '2026-02-01T14:05:00Z',
  },
  106: {
    sarpanchName: 'माधवराव उइके',
    secretaryName: 'सुधाकर वानखेडे',
    contactPhone: '9975000022',
    electedCommittee: null,
    updatedAt: '2025-08-11T12:00:00Z',
  },
  107: {
    sarpanchName: 'सुनंदा आहिरे',
    secretaryName: 'कैलास बागुल',
    contactPhone: '9658000033',
    electedCommittee: null,
    updatedAt: '2025-12-05T09:00:00Z',
  },
  108: {
    sarpanchName: 'प्रकाश कोळी',
    secretaryName: 'संतोष पाटील',
    contactPhone: '9552000044',
    electedCommittee: null,
    updatedAt: '2026-01-28T16:30:00Z',
  },
};

export function getMockHierarchy(): Hierarchy {
  return mockHierarchy;
}

/** Deterministic pseudo-random in [0, 1) derived from ids, so mocks are stable. */
function seeded(panchayatId: number, fy: number, salt = 0): number {
  const x = Math.sin(panchayatId * 97 + fy * 131 + salt * 53) * 10000;
  return x - Math.floor(x);
}

const round2 = (n: number): number => Math.round(n * 100) / 100;

const FY_HEADS: Record<string, string[]> = {
  MGNREGA: ['सिव्हिल कामे', 'मजुरी', 'साहित्य'],
  '15FC': ['सिव्हिल कामे', 'देखभाल', 'प्रशासकीय'],
  'SBM-G': ['शौचालय बांधकाम', 'स्वच्छता उपकरणे'],
  'PMAY-G': ['घर बांधकाम'],
  RKVY: ['शेती विकास कामे', 'बी-बियाणे'],
};

const HEADS_EN: Record<string, string[]> = {
  MGNREGA: ['Civil works', 'Wages', 'Materials'],
  '15FC': ['Civil works', 'Maintenance', 'Administrative'],
  'SBM-G': ['Toilet construction', 'Sanitation equipment'],
  'PMAY-G': ['House construction'],
  RKVY: ['Farm works', 'Seeds'],
};

export const AVAILABLE_FYS = [2022, 2023, 2024];

export function getMockFinance(panchayatId: number, fy: number): PanchayatFinance {
  const byScheme = mockSchemes.map((scheme, i) => {
    const grants = round2(seeded(panchayatId, fy, i) * 9_000_000 + 2_000_000);
    const spendRatio = 0.55 + seeded(panchayatId, fy, i + 7) * 0.4;
    const expenditure = round2(grants * spendRatio);
    return { scheme, grants, expenditure };
  });

  const grants = byScheme.flatMap((s) => {
    const count = 1 + Math.floor(seeded(panchayatId, fy, s.scheme.id + 3) * 2);
    return Array.from({ length: count }, (_, k) => ({
      scheme: s.scheme,
      amount: round2(s.grants / count),
      source: s.scheme.nameEn,
      disbursedAt: `${fy}-${String(4 + k * 3).padStart(2, '0')}-15T00:00:00Z`,
    }));
  });

  const expenditures = byScheme.flatMap((s) => {
    const heads = FY_HEADS[s.scheme.code] ?? FY_HEADS['15FC'];
    const headsEn = HEADS_EN[s.scheme.code] ?? HEADS_EN['15FC'];
    return heads.map((head, i) => ({
      scheme: s.scheme,
      head: `${head} / ${headsEn[i]}`,
      amount: round2(s.expenditure / heads.length),
    }));
  });

  const totalGrants = round2(byScheme.reduce((sum, s) => sum + s.grants, 0));
  const totalExpenditure = round2(byScheme.reduce((sum, s) => sum + s.expenditure, 0));

  return {
    fy,
    availableFys: AVAILABLE_FYS,
    summary: {
      totalGrants,
      totalExpenditure,
      balance: round2(totalGrants - totalExpenditure),
      byScheme,
      grants,
      expenditures,
    },
  };
}

export function getMockPanchayat(id: number): PanchayatDetail | undefined {
  const panchayat = mockPanchayats.find((p) => p.id === id);
  if (!panchayat) return undefined;
  return { ...withLocation(panchayat), profile: profiles[id] ?? emptyProfile() };
}

function emptyProfile(): PanchayatProfile {
  return {
    sarpanchName: null,
    secretaryName: null,
    contactPhone: null,
    electedCommittee: null,
    updatedAt: null,
  };
}

export function searchMockPanchayats(query: SearchQuery): Panchayat[] {
  const q = (query.q ?? '').trim().toLowerCase();
  return mockPanchayats
    .filter((p) => {
      if (query.districtId != null && p.districtId !== query.districtId) return false;
      if (query.talukaId != null && p.talukaId !== query.talukaId) return false;
      if (q && !p.nameMr.toLowerCase().includes(q) && !p.nameEn.toLowerCase().includes(q)) {
        return false;
      }
      return true;
    })
    .map(withLocation);
}
