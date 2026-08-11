// BoosterTalents API 数据层：统一人才检索（替换飞书数据源）
// 文档: BoosterTalents API 对接文档（内部提供）

const BASE_URL = process.env.BOOSTER_TALENTS_BASE_URL!;
const API_KEY = process.env.BOOSTER_TALENTS_API_KEY!;

// ─── 原始响应形状（BoosterTalents 侧） ─────────────────────────

export interface BoosterTalentRaw {
  talent_id: number | string;
  person_id: string;
  name: string | null;
  current_company: string | null;
  current_title: string | null;
  city: string | null;
  estimated_age: number | null;
  age_is_estimated: boolean;
  years_exp: number | null;
  highest_degree: string | null;
  highest_school: string | null;
  employment_type: string | null;
  industry_tags: string[];
  skill_tags: string[];
  seniority: string[];
  stock_codes: string[];
  work_locations: string[];
  has_listed_company_experience: boolean;
  city_is_missing: boolean;
  source_count: number;
  profile_completeness: Record<string, unknown>;
  hits?: unknown[];
  filter_hits?: unknown[];
}

export interface BoosterTalentDetailRaw extends BoosterTalentRaw {
  gender: string | null;
  birthday: string | null;
  age: number | null;
  primary_url: string | null;
  recruiter_note: string | null;
  major: string | null;
  work_start: string | null;
  schools: Array<{ school?: string; degree?: string; major?: string; start?: string; end?: string }>;
  companies: Array<{ company?: string; title?: string; start?: string; end?: string }>;
  internships: unknown[];
  summary_profile?: string | null;
  summary_work?: string | null;
  summary_education?: string | null;
  summary_skills?: string | null;
  summary_eval?: string | null;
  extras: { urls?: string[]; stock_codes?: string[]; work_locations?: string[] };
  has_contacts: boolean;
  sources?: unknown[];
  has_resume: boolean;
  resume_chars?: number;
  resume_filename?: string;
  resume_markdown?: string;
}

interface SearchResponseRaw {
  count: number;
  total_count: number;
  next_cursor: string | null;
  results: BoosterTalentRaw[];
}

interface FacetBucket {
  value: string;
  count: number;
}

interface FacetsResponseRaw {
  total: number;
  city: FacetBucket[];
  highest_degree: FacetBucket[];
  employment_type: FacetBucket[];
  industry_tags: FacetBucket[];
  skill_tags: FacetBucket[];
  seniority: FacetBucket[];
  age_coverage: Record<string, unknown>;
}

// ─── 我们自己的规范化领域模型 ────────────────────────────────

export interface Executive {
  id: string;
  name: string;
  company: string | null;
  position: string | null;
  exchange: string;
  stockCode: string | null;
  stockCodes: string[];
  industry: string | null;
  subIndustry: string | null;
  industryTags: string[];
  education: string | null;
  age: number | null;
  ageIsEstimated: boolean;
  city: string | null;
  workLocations: string[];
  hasListedCompanyExperience: boolean;
  seniority: string[];
  skillTags: string[];
  sourceCount: number;
  // 新数据源不采集，前端置灰展示"暂无数据"
  marketCap: null;
  marketCapCurrency: null;
  listingYear: null;
  registrationLoc: null;
  gender: null;
  isIPOServing: null;
  // 近似匹配标签（查询时算出，非字段映射）
  approxCPA?: boolean;
  approxBig4?: boolean;
  approxIB?: boolean;
}

export interface ExecutiveDetail extends Executive {
  birthday: string | null;
  primaryUrl: string | null;
  school: string | null;
  major: string | null;
  companies: Array<{ company?: string; title?: string; start?: string; end?: string }>;
  schools: Array<{ school?: string; degree?: string; major?: string; start?: string; end?: string }>;
  summaryProfile: string | null;
  summaryWork: string | null;
  summaryEducation: string | null;
  hasResume: boolean;
  resumeMarkdown?: string;
}

// ─── 底层 fetch 封装 ────────────────────────────────────────

class BoosterApiError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, body: unknown) {
    super(`BoosterTalents API ${status}: ${JSON.stringify(body).slice(0, 300)}`);
    this.status = status;
    this.body = body;
  }
}

async function boosterFetch<T>(path: string, params: Array<[string, string]> = []): Promise<T> {
  const url = new URL(`${BASE_URL}${path}`);
  for (const [k, v] of params) url.searchParams.append(k, v);

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${API_KEY}`, Accept: "application/json" },
    signal: AbortSignal.timeout(30_000),
  });
  const body = await res.json();
  if (!res.ok) throw new BoosterApiError(res.status, body);
  return body as T;
}

// ─── 板块推导 ───────────────────────────────────────────────

export function deriveExchange(stockCodes: string[]): string {
  const primary = (stockCodes || []).find(Boolean);
  if (!primary) return "未知";
  const code = primary.toUpperCase();

  if (code.endsWith(".HK")) return "港股";

  const m = code.match(/^(\d{6})\.(SH|SZ|BJ)$/);
  if (m) {
    const [, num, suffix] = m;
    if (suffix === "BJ") return "北交所";
    if (num.startsWith("688")) return "科创板";
    if (num.startsWith("300") || num.startsWith("301")) return "创业板";
    if (num.startsWith("8") || num.startsWith("4")) return "北交所";
    return "主板";
  }

  if (/^\d{6}$/.test(code)) {
    if (code.startsWith("688")) return "科创板";
    if (code.startsWith("300") || code.startsWith("301")) return "创业板";
    if (code.startsWith("8") || code.startsWith("4")) return "北交所";
    return "主板";
  }

  return "美股/未知";
}

// ─── 映射函数 ───────────────────────────────────────────────

function mapTalentToExecutive(raw: BoosterTalentRaw): Executive {
  const stockCodes = (raw.stock_codes || []).filter(Boolean);
  const industryTags = raw.industry_tags || [];
  return {
    id: String(raw.talent_id),
    name: raw.name || "",
    company: raw.current_company,
    position: raw.current_title,
    exchange: deriveExchange(stockCodes),
    stockCode: stockCodes[0] || null,
    stockCodes,
    industry: industryTags[0] || null,
    subIndustry: industryTags[1] || null,
    industryTags,
    education: raw.highest_degree,
    age: raw.estimated_age,
    ageIsEstimated: raw.age_is_estimated,
    city: raw.city,
    workLocations: raw.work_locations || [],
    hasListedCompanyExperience: raw.has_listed_company_experience,
    seniority: raw.seniority || [],
    skillTags: raw.skill_tags || [],
    sourceCount: raw.source_count,
    marketCap: null,
    marketCapCurrency: null,
    listingYear: null,
    registrationLoc: null,
    gender: null,
    isIPOServing: null,
  };
}

function mapDetailToExecutive(raw: BoosterTalentDetailRaw): ExecutiveDetail {
  const base = mapTalentToExecutive(raw);
  return {
    ...base,
    birthday: raw.birthday,
    primaryUrl: raw.primary_url,
    school: raw.highest_school,
    major: raw.major,
    companies: raw.companies || [],
    schools: raw.schools || [],
    summaryProfile: raw.summary_profile ?? null,
    summaryWork: raw.summary_work ?? null,
    summaryEducation: raw.summary_education ?? null,
    hasResume: raw.has_resume,
    resumeMarkdown: raw.resume_markdown,
  };
}

// ─── 搜索参数 ───────────────────────────────────────────────

export interface SearchTalentsParams {
  q?: string;
  city?: string[];
  industryTags?: string[];
  seniority?: string[];
  degree?: string[];
  hasListed?: boolean;
  ageMin?: number;
  ageMax?: number;
  cursor?: string | null;
  limit?: number;
  sort?: "auto" | "relevance" | "updated_at";
  match?: "auto" | "all" | "any";
}

function buildFilterParams(params: SearchTalentsParams): Array<[string, string]> {
  const out: Array<[string, string]> = [];

  if (params.q) out.push(["q", params.q]);
  if (params.match) out.push(["match", params.match]);
  if (params.sort) out.push(["sort", params.sort]);
  if (params.hasListed) out.push(["f", "listed:true"]);
  if (params.ageMin != null) out.push(["f", `age:>=${params.ageMin}`]);
  if (params.ageMax != null) out.push(["f", `age:<=${params.ageMax}`]);

  if (params.city?.length) out.push(["any_f", `city:${params.city.join("|")}`]);
  if (params.industryTags?.length) out.push(["any_f", `industry:${params.industryTags.join("|")}`]);
  if (params.seniority?.length) out.push(["any_f", `level:${params.seniority.join("|")}`]);
  if (params.degree?.length) out.push(["any_f", `degree:${params.degree.join("|")}`]);

  out.push(["limit", String(params.limit ?? 50)]);
  if (params.cursor) out.push(["cursor", params.cursor]);

  return out;
}

export interface SearchTalentsResult {
  data: Executive[];
  totalCount: number;
  nextCursor: string | null;
  hasMore: boolean;
}

export async function searchTalents(params: SearchTalentsParams): Promise<SearchTalentsResult> {
  const qp = buildFilterParams(params);
  const resp = await boosterFetch<SearchResponseRaw>("/api/unified/talents", qp);
  return {
    data: (resp.results || []).map(mapTalentToExecutive),
    totalCount: resp.total_count,
    nextCursor: resp.next_cursor,
    hasMore: !!resp.next_cursor,
  };
}

export async function getTalentDetail(
  talentId: string,
  opts?: { includeResume?: boolean }
): Promise<ExecutiveDetail> {
  const params: Array<[string, string]> = [
    ["include_sources", "true"],
    ["include_resume", opts?.includeResume ? "true" : "false"],
  ];
  const raw = await boosterFetch<BoosterTalentDetailRaw>(`/api/unified/talents/${talentId}`, params);
  return mapDetailToExecutive(raw);
}

// ─── Facets（筛选项）─────────────────────────────────────────

export interface Facets {
  cities: FacetBucket[];
  degrees: FacetBucket[];
  employmentTypes: FacetBucket[];
  industryTags: FacetBucket[];
  seniority: FacetBucket[];
  total: number;
  ageCoverage: Record<string, unknown>;
}

let _facetsCache: Facets | null = null;
let _facetsCacheTime = 0;
const FACETS_CACHE_TTL = 10 * 60 * 1000;

export async function getFacets(top = 50): Promise<Facets> {
  if (_facetsCache && Date.now() - _facetsCacheTime < FACETS_CACHE_TTL) return _facetsCache;

  const raw = await boosterFetch<FacetsResponseRaw>("/api/unified/facets", [["top", String(top)]]);
  _facetsCache = {
    cities: raw.city || [],
    degrees: raw.highest_degree || [],
    employmentTypes: raw.employment_type || [],
    industryTags: raw.industry_tags || [],
    seniority: raw.seniority || [],
    total: raw.total,
    ageCoverage: raw.age_coverage || {},
  };
  _facetsCacheTime = Date.now();
  return _facetsCache;
}

// ─── CPA / Big4 / 投行 近似匹配 ──────────────────────────────

const APPROX_TAG_SYNONYMS: Record<"cpa" | "big4" | "ib", string[]> = {
  cpa: ["CPA", "注册会计师"],
  big4: ["普华永道", "德勤", "毕马威", "安永", "PwC", "Deloitte", "KPMG", "EY"],
  ib: ["投行", "投资银行", "券商", "高盛", "摩根", "中金", "中信证券"],
};

async function fetchApproxTagIds(
  tag: "cpa" | "big4" | "ib",
  baseParams: SearchTalentsParams
): Promise<Set<string>> {
  const ids = new Set<string>();
  const synonyms = APPROX_TAG_SYNONYMS[tag];

  await Promise.all(
    synonyms.map(async (word) => {
      try {
        const qp = buildFilterParams({ ...baseParams, q: word, match: "all", limit: 100, cursor: null });
        const resp = await boosterFetch<SearchResponseRaw>("/api/unified/talents", qp);
        for (const r of resp.results || []) ids.add(String(r.talent_id));
      } catch {
        // 单个同义词查询失败不阻塞其它同义词
      }
    })
  );

  return ids;
}

export interface ApproxTagFlags {
  hasCPA?: boolean;
  hasBig4?: boolean;
  hasIB?: boolean;
}

/**
 * 对已经拿到的一页结果，按勾选的近似标签做交集过滤 + 标记。
 * 结构化筛选条件（不含 q/cursor）复用自 baseParams，保证同义词查询和主查询在同一筛选范围内。
 */
export async function applyApproxTagFilters(
  page: Executive[],
  baseParams: SearchTalentsParams,
  flags: ApproxTagFlags
): Promise<Executive[]> {
  const activeTags = (["cpa", "big4", "ib"] as const).filter(
    (t) => flags[`has${t === "cpa" ? "CPA" : t === "big4" ? "Big4" : "IB"}` as keyof ApproxTagFlags]
  );
  if (activeTags.length === 0) return page;

  const idSets = await Promise.all(activeTags.map((t) => fetchApproxTagIds(t, baseParams)));

  return page
    .filter((exec) => idSets.every((set) => set.has(exec.id)))
    .map((exec) => {
      const marked = { ...exec };
      activeTags.forEach((t, i) => {
        if (t === "cpa") marked.approxCPA = idSets[i].has(exec.id);
        if (t === "big4") marked.approxBig4 = idSets[i].has(exec.id);
        if (t === "ib") marked.approxIB = idSets[i].has(exec.id);
      });
      return marked;
    });
}
