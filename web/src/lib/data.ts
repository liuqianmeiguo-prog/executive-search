import localDataJson from "../../data.json";

// search.html が期待するフィールド名をそのまま使用
export interface Executive {
  name: string;
  stockCode: string;
  companyName: string;
  exchange: string;
  position: string;
  industry: string;
  subIndustry: string;
  marketCapValue: number | null;
  marketCapCurrency: string;
  listingYear: number | null;
  registrationLoc: string;
  age: number | null;
  gender: string;
  isIPOServing: boolean;
  background: string;
  hasCPA: boolean;
  hasIB: boolean;
  education: string[];
  careerItems: unknown[];
  highlights: string[];
}

const _allData: Executive[] = (localDataJson as unknown as Executive[]).map((r) => ({
  name:              r.name ?? "",
  stockCode:         r.stockCode ?? "",
  companyName:       r.companyName ?? "",
  exchange:          r.exchange ?? "",
  position:          r.position ?? "",
  industry:          r.industry ?? "",
  subIndustry:       r.subIndustry ?? "",
  marketCapValue:    r.marketCapValue != null ? Number(r.marketCapValue) : null,
  marketCapCurrency: r.marketCapCurrency ?? "CNY",
  listingYear:       r.listingYear != null ? Number(r.listingYear) : null,
  registrationLoc:   r.registrationLoc ?? "",
  age:               r.age != null ? Number(r.age) : null,
  gender:            r.gender ?? "",
  isIPOServing:      r.isIPOServing ?? false,
  background:        r.background ?? "",
  hasCPA:            r.hasCPA ?? false,
  hasIB:             r.hasIB ?? false,
  education:         Array.isArray(r.education) ? r.education : [],
  careerItems:       Array.isArray(r.careerItems) ? r.careerItems : [],
  highlights:        Array.isArray(r.highlights) ? r.highlights : [],
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
  if (company)             rows = rows.filter(r => r.companyName.toLowerCase().includes(company.toLowerCase()));
  if (exchange?.length)    rows = rows.filter(r => exchange.includes(r.exchange));
  if (industry?.length)    rows = rows.filter(r => industry.includes(r.industry));
  if (subIndustry?.length) rows = rows.filter(r => subIndustry.includes(r.subIndustry));
  if (position)            rows = rows.filter(r => r.position.toLowerCase().includes(position.toLowerCase()));
  if (capMin != null)      rows = rows.filter(r => r.marketCapValue != null && r.marketCapValue >= capMin);
  if (capMax != null)      rows = rows.filter(r => r.marketCapValue != null && r.marketCapValue <= capMax);

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
