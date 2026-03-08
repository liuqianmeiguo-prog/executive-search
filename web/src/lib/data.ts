import path from "path";
import fs from "fs";

export interface Executive {
  name: string;
  company: string;
  exchange: string;
  position: string;
  industry: string;
  subIndustry: string;
  marketCap: number | null;
  marketCapCurrency: string;
  education: string;
  birthday: string;
  tenure: string;
  code: string;
}

let _cache: Executive[] | null = null;

export function getAllData(): Executive[] {
  if (_cache) return _cache;

  // data.json 放在 web/ 根目录（Vercel 部署时与 next.config.ts 同级）
  const dataPath = path.join(process.cwd(), "data.json");
  const raw = fs.readFileSync(dataPath, "utf-8");
  _cache = JSON.parse(raw) as Executive[];
  return _cache;
}

export function searchData(params: {
  name?: string;
  company?: string;
  exchange?: string[];
  industry?: string[];
  subIndustry?: string[];
  position?: string;
  capMin?: number;
  capMax?: number;
  page?: number;
  pageSize?: number;
}): { data: Executive[]; total: number; page: number; pageSize: number } {
  const {
    name,
    company,
    exchange,
    industry,
    subIndustry,
    position,
    capMin,
    capMax,
    page = 1,
    pageSize = 50,
  } = params;

  let rows = getAllData();

  if (name) {
    const q = name.toLowerCase();
    rows = rows.filter((r) => r.name.toLowerCase().includes(q));
  }
  if (company) {
    const q = company.toLowerCase();
    rows = rows.filter((r) => r.company.toLowerCase().includes(q));
  }
  if (exchange?.length) {
    rows = rows.filter((r) => exchange.includes(r.exchange));
  }
  if (industry?.length) {
    rows = rows.filter((r) => industry.includes(r.industry));
  }
  if (subIndustry?.length) {
    rows = rows.filter((r) => subIndustry.includes(r.subIndustry));
  }
  if (position) {
    const q = position.toLowerCase();
    rows = rows.filter((r) => r.position.toLowerCase().includes(q));
  }
  if (capMin != null) {
    rows = rows.filter((r) => r.marketCap != null && r.marketCap >= capMin);
  }
  if (capMax != null) {
    rows = rows.filter((r) => r.marketCap != null && r.marketCap <= capMax);
  }

  const total = rows.length;
  const start = (page - 1) * pageSize;
  const data = rows.slice(start, start + pageSize);

  return { data, total, page, pageSize };
}

export function getFilterOptions() {
  const rows = getAllData();
  const exchanges = [...new Set(rows.map((r) => r.exchange))].filter(Boolean).sort();
  const industries = [...new Set(rows.map((r) => r.industry))].filter(Boolean).sort();
  const subIndustries = [...new Set(rows.map((r) => r.subIndustry))].filter(Boolean).sort();
  return { exchanges, industries, subIndustries };
}
