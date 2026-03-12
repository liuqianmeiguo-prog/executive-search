import localDataJson from "../../data.json";

export interface Executive {
  name: string;
  company: string;
  code: string;
  exchange: string;
  position: string;
  industry: string;
  subIndustry: string;
  marketCap: number | null;
  marketCapCurrency: string;
  listingYear: number | null;
  province: string;
  education: string;
  birthday: string;
  tenure: string;
  detail?: string;
}

interface LocalRecord {
  name: string; companyName: string; stockCode: string; exchange: string;
  position: string; industry: string; subIndustry: string;
  marketCapValue?: number; marketCapCurrency?: string; listingYear?: number;
  registrationLoc?: string; education?: string[]; age?: number;
  detail?: string;
}

const _allData: Executive[] = (localDataJson as unknown as LocalRecord[]).map((r) => ({
  name:              r.name ?? "",
  company:           r.companyName ?? "",
  code:              r.stockCode ?? "",
  exchange:          r.exchange ?? "",
  position:          r.position ?? "",
  industry:          r.industry ?? "",
  subIndustry:       r.subIndustry ?? "",
  marketCap:         r.marketCapValue != null ? Number(r.marketCapValue) : null,
  marketCapCurrency: r.marketCapCurrency ?? "CNY",
  listingYear:       r.listingYear != null ? Number(r.listingYear) : null,
  province:          r.registrationLoc ?? "",
  education:         Array.isArray(r.education) ? r.education.join(",") : "",
  birthday:          r.age != null ? String(r.age) : "",
  tenure:            "",
  detail:            r.detail ?? undefined,
}));

console.log(`数据加载完成，共 ${_allData.length} 条`);

export async function getAllData(): Promise<Executive[]> {
  return _allData;
}

export async function searchData(params: {
  name?: string; company?: string; exchange?: string[]; industry?: string[];
  subIndustry?: string[]; position?: string; capMin?: number; capMax?: number;
  page?: number; pageSize?: number;
}): Promise<{ data: Executive[]; total: number; page: number; pageSize: number }> {
  const { name, company, exchange, industry, subIndustry, position, capMin, capMax, page = 1, pageSize = 50 } = params;

  let rows = _allData;
  if (name)                rows = rows.filter(r => r.name.toLowerCase().includes(name.toLowerCase()));
  if (company)             rows = rows.filter(r => r.company.toLowerCase().includes(company.toLowerCase()));
  if (exchange?.length)    rows = rows.filter(r => exchange.includes(r.exchange));
  if (industry?.length)    rows = rows.filter(r => industry.includes(r.industry));
  if (subIndustry?.length) rows = rows.filter(r => subIndustry.includes(r.subIndustry));
  if (position)            rows = rows.filter(r => r.position.toLowerCase().includes(position.toLowerCase()));
  if (capMin != null)      rows = rows.filter(r => r.marketCap != null && r.marketCap >= capMin);
  if (capMax != null)      rows = rows.filter(r => r.marketCap != null && r.marketCap <= capMax);

  const total = rows.length;
  const start = (page - 1) * pageSize;
  return { data: rows.slice(start, start + pageSize), total, page, pageSize };
}

export async function getFilterOptions() {
  const exchanges     = [...new Set(_allData.map(r => r.exchange))].filter(Boolean).sort();
  const industries    = [...new Set(_allData.map(r => r.industry))].filter(Boolean).sort();
  const subIndustries = [...new Set(_allData.map(r => r.subIndustry))].filter(Boolean).sort();
  return { exchanges, industries, subIndustries };
}
