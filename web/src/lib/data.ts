// 数据层：从飞书多维表格读取高管数据（飞书失败时自动回退到本地 data.json）
// 飞书应用：cli_a924f52e217bdbd3
// 多维表格：PlCRboHS2a62jmsa33tcRjYUntg / tbl6ymvSFfkOoCsp
import path from "path";
import fs from "fs";

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
  listingYear: number | null;      // 上市年份
  province: string;                 // 注册省份
  education: string;                // 最高学历
  birthday: string;                 // 出生年份
  tenure: string;                   // 任职起始时间
  detail?: string;                  // 详细履历（来自 Qiankun 数据）
}

// ─── 飞书 API ───────────────────────────────────────────────

const FEISHU_APP_ID     = process.env.FEISHU_APP_ID!;
const FEISHU_APP_SECRET = process.env.FEISHU_APP_SECRET!;
const BITABLE_APP_TOKEN = process.env.BITABLE_APP_TOKEN || "PlCRboHS2a62jmsa33tcRjYUntg";
const BITABLE_TABLE_ID  = process.env.BITABLE_TABLE_ID  || "tbl6ymvSFfkOoCsp";

async function getTenantAccessToken(): Promise<string> {
  const res = await fetch("https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ app_id: FEISHU_APP_ID, app_secret: FEISHU_APP_SECRET }),
  });
  const json = await res.json() as { tenant_access_token: string };
  return json.tenant_access_token;
}

async function fetchAllRecords(token: string): Promise<Executive[]> {
  const results: Executive[] = [];
  let pageToken: string | undefined;

  do {
    const url = new URL(
      `https://open.feishu.cn/open-apis/bitable/v1/apps/${BITABLE_APP_TOKEN}/tables/${BITABLE_TABLE_ID}/records`
    );
    url.searchParams.set("page_size", "500");
    if (pageToken) url.searchParams.set("page_token", pageToken);

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}` },
    });
    const json = await res.json() as {
      code: number;
      data: {
        items: Array<{ fields: Record<string, unknown> }>;
        has_more: boolean;
        page_token?: string;
      };
    };

    if (json.code !== 0) {
      throw new Error(`飞书 API 错误 ${json.code}`);
    }

    for (const item of json.data.items) {
      const f = item.fields;
      results.push({
        name:              String(f["姓名"]           ?? ""),
        company:           String(f["公司名称"]        ?? ""),
        code:              String(f["股票代码"]        ?? ""),
        exchange:          String(f["上市板块"]        ?? ""),
        position:          String(f["职位"]            ?? ""),
        industry:          String(f["一级行业"]        ?? ""),
        subIndustry:       String(f["二级行业"]        ?? ""),
        marketCap:         f["市值（亿）"] != null ? Number(f["市值（亿）"]) : null,
        marketCapCurrency: String(f["市值币种"]        ?? "CNY"),
        listingYear:       f["上市年份"] != null ? Number(f["上市年份"]) : null,
        province:          String(f["注册省份"]        ?? ""),
        education:         String(f["最高学历"]        ?? ""),
        birthday:          String(f["出生年份"]        ?? ""),
        tenure:            String(f["任职起始时间"]    ?? ""),
      });
    }

    pageToken = json.data.has_more ? json.data.page_token : undefined;
  } while (pageToken);

  return results;
}

// ─── 缓存（TTL 10分钟）──────────────────────────────────────

let _cache: Executive[] | null = null;
let _cacheTime = 0;
const CACHE_TTL = 10 * 60 * 1000;

export async function getAllData(): Promise<Executive[]> {
  if (_cache && Date.now() - _cacheTime < CACHE_TTL) return _cache;

  try {
    const token = await getTenantAccessToken();
    _cache = await fetchAllRecords(token);
    _cacheTime = Date.now();
    console.log(`飞书多维表格加载完成，共 ${_cache.length} 条`);
  } catch (e) {
    console.error("飞书多维表格加载失败，回退到本地 data.json:", e);
    if (_cache) return _cache;
    _cache = loadLocalData();
    _cacheTime = Date.now();
  }

  return _cache;
}

// ─── 本地 data.json 回退 ────────────────────────────────────

interface LocalRecord {
  name: string; companyName: string; stockCode: string; exchange: string;
  position: string; industry: string; subIndustry: string;
  marketCapValue?: number; marketCapCurrency?: string; listingYear?: number;
  registrationLoc?: string; education?: string[]; age?: number;
  detail?: string;
}

function loadLocalData(): Executive[] {
  try {
    const candidates = [
      path.join(process.cwd(), "data.json"),
      path.join(process.cwd(), "web", "data.json"),
    ];
    for (const p of candidates) {
      if (fs.existsSync(p)) {
        const raw = JSON.parse(fs.readFileSync(p, "utf-8")) as LocalRecord[];
        console.log(`从本地 data.json 加载完成，共 ${raw.length} 条`);
        return raw.map((r) => ({
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
      }
    }
  } catch (e) {
    console.error("本地 data.json 加载失败:", e);
  }
  return [];
}

export async function searchData(params: {
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
}): Promise<{ data: Executive[]; total: number; page: number; pageSize: number }> {
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

  let rows = await getAllData();

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

export async function getFilterOptions() {
  const rows = await getAllData();
  const exchanges = [...new Set(rows.map((r) => r.exchange))].filter(Boolean).sort();
  const industries = [...new Set(rows.map((r) => r.industry))].filter(Boolean).sort();
  const subIndustries = [...new Set(rows.map((r) => r.subIndustry))].filter(Boolean).sort();
  return { exchanges, industries, subIndustries };
}
