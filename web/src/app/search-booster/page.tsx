"use client";

import { useState, useEffect, useCallback, useRef } from "react";

// ── Types ──

interface Executive {
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
  marketCap: null;
  marketCapCurrency: null;
  listingYear: null;
  registrationLoc: null;
  gender: null;
  isIPOServing: null;
  approxCPA?: boolean;
  approxBig4?: boolean;
  approxIB?: boolean;
}

interface ExecutiveDetail extends Executive {
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
}

interface FacetBucket {
  value: string;
  count: number;
}

interface Facets {
  cities: FacetBucket[];
  degrees: FacetBucket[];
  employmentTypes: FacetBucket[];
  industryTags: FacetBucket[];
  seniority: FacetBucket[];
  total: number;
}

interface SearchParams {
  q: string;
  city: string[];
  industryTags: string[];
  seniority: string[];
  degree: string[];
  hasListed: boolean;
  ageMin: string;
  ageMax: string;
  hasCPA: boolean;
  hasBig4: boolean;
  hasIB: boolean;
  limit: number;
}

const DEFAULT_PARAMS: SearchParams = {
  q: "",
  city: [],
  industryTags: [],
  seniority: [],
  degree: [],
  hasListed: false,
  ageMin: "",
  ageMax: "",
  hasCPA: false,
  hasBig4: false,
  hasIB: false,
  limit: 50,
};

export default function SearchBoosterPage() {
  const [facets, setFacets] = useState<Facets | null>(null);
  const [data, setData] = useState<Executive[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [params, setParams] = useState<SearchParams>(DEFAULT_PARAMS);

  // cursor 分页：只支持上一页/下一页，不支持跳页
  const [cursorHistory, setCursorHistory] = useState<(string | null)[]>([null]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);

  const [selectedExec, setSelectedExec] = useState<ExecutiveDetail | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isInitial = useRef(true);

  // ── Load facets on mount ──

  useEffect(() => {
    fetch("/api/booster/filters")
      .then((r) => r.json())
      .then((f: Facets) => setFacets(f))
      .catch(() => setError("加载筛选项失败"));
  }, []);

  // ── Build query string ──

  const buildQuery = useCallback((p: SearchParams, cursor: string | null): string => {
    const sp = new URLSearchParams();
    if (p.q) sp.set("q", p.q);
    p.city.forEach((c) => sp.append("city", c));
    p.industryTags.forEach((t) => sp.append("industryTags", t));
    p.seniority.forEach((s) => sp.append("seniority", s));
    p.degree.forEach((d) => sp.append("degree", d));
    if (p.hasListed) sp.set("hasListed", "true");
    if (p.ageMin) sp.set("ageMin", p.ageMin);
    if (p.ageMax) sp.set("ageMax", p.ageMax);
    if (p.hasCPA) sp.set("hasCPA", "true");
    if (p.hasBig4) sp.set("hasBig4", "true");
    if (p.hasIB) sp.set("hasIB", "true");
    sp.set("limit", String(p.limit));
    if (cursor) sp.set("cursor", cursor);
    return sp.toString();
  }, []);

  // ── Fetch data ──

  const fetchData = useCallback(
    async (p: SearchParams, cursor: string | null) => {
      setLoading(true);
      setError(null);
      try {
        const qs = buildQuery(p, cursor);
        const res = await fetch(`/api/booster/search?${qs}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        setData(json.data || []);
        setTotalCount(json.totalCount || 0);
        setHasMore(!!json.hasMore);
        setNextCursor(json.nextCursor ?? null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "搜索失败");
        setData([]);
        setTotalCount(0);
        setHasMore(false);
        setNextCursor(null);
      } finally {
        setLoading(false);
      }
    },
    [buildQuery]
  );

  // 筛选条件变化：重置游标，重新拉首页
  useEffect(() => {
    if (isInitial.current) {
      isInitial.current = false;
      fetchData(params, null);
      return;
    }
    setCursorHistory([null]);
    setCurrentIndex(0);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchData(params, null);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  // ── Helpers ──

  const updateParam = useCallback(
    <K extends keyof SearchParams>(key: K, value: SearchParams[K]) => {
      setParams((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  const resetParams = useCallback(() => setParams(DEFAULT_PARAMS), []);

  const goNextPage = useCallback(async () => {
    if (!nextCursor) return;
    setCursorHistory((prev) => [...prev, nextCursor]);
    setCurrentIndex((prev) => prev + 1);
    await fetchData(params, nextCursor);
  }, [nextCursor, params, fetchData]);

  const goPrevPage = useCallback(async () => {
    if (currentIndex === 0) return;
    const prevCursor = cursorHistory[currentIndex - 1];
    setCurrentIndex((prev) => prev - 1);
    await fetchData(params, prevCursor);
  }, [cursorHistory, currentIndex, params, fetchData]);

  // ── Detail drawer ──

  const openDetail = useCallback(async (exec: Executive) => {
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/booster/talents/${exec.id}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const detail = await res.json();
      setSelectedExec(detail);
      setDrawerOpen(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "获取详情失败");
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const closeDetail = useCallback(() => {
    setDrawerOpen(false);
    setSelectedExec(null);
  }, []);

  // ── CSV export（最多导出当前筛选下的前 200 条，不做无限翻游标）──

  const exportCSV = useCallback(async () => {
    const qs = buildQuery({ ...params, limit: 100 }, null);
    const res = await fetch(`/api/booster/search?${qs}`);
    const json = await res.json();
    const rows: Executive[] = json.data || [];
    const headers = [
      "talent_id", "姓名", "当前公司", "当前职位", "板块", "股票代码",
      "行业标签", "学历", "年龄", "城市", "上市公司任职经历",
      "CPA(近似)", "Big4(近似)", "投行(近似)",
    ];
    const csvRows = [headers.join(",")];
    for (const r of rows) {
      csvRows.push(
        [
          r.id, r.name, `"${r.company || ""}"`, `"${r.position || ""}"`, r.exchange,
          r.stockCode || "", `"${r.industryTags.join("; ")}"`, r.education || "",
          r.age ?? "", r.city || "", r.hasListedCompanyExperience ? "Y" : "",
          r.approxCPA ? "Y" : "", r.approxBig4 ? "Y" : "", r.approxIB ? "Y" : "",
        ].join(",")
      );
    }
    const blob = new Blob(["﻿" + csvRows.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "booster_talents.csv";
    a.click();
    URL.revokeObjectURL(url);
  }, [params, buildQuery]);

  // ── Loading state for facets ──

  if (!facets) {
    return (
      <div className="flex items-center justify-center min-h-screen text-gray-500">
        加载筛选项中...
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50">
      {/* ── Left Sidebar ── */}
      <aside className="w-72 bg-white border-r border-gray-200 overflow-y-auto p-4 flex flex-col gap-3 shrink-0">
        <h2 className="text-lg font-semibold text-gray-800">筛选条件</h2>
        <p className="text-xs text-gray-400">数据源：BoosterTalents（统一人才库，共 {facets.total} 人）</p>

        <div>
          <label className="text-xs text-gray-500">姓名 / 公司 / 关键词</label>
          <input
            type="text"
            value={params.q}
            onChange={(e) => updateParam("q", e.target.value)}
            placeholder="如 CFO、腾讯、张伟..."
            className="w-full border rounded px-2 py-1 text-sm"
          />
        </div>

        {/* City */}
        <fieldset className="border rounded p-2">
          <legend className="text-xs text-gray-500 px-1">城市</legend>
          <div className="max-h-32 overflow-y-auto">
            {facets.cities.slice(0, 30).map((c) => (
              <label key={c.value} className="flex items-center gap-1 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={params.city.includes(c.value)}
                  onChange={(e) => {
                    const next = e.target.checked
                      ? [...params.city, c.value]
                      : params.city.filter((v) => v !== c.value);
                    updateParam("city", next);
                  }}
                />
                {c.value} <span className="text-gray-400">({c.count})</span>
              </label>
            ))}
          </div>
        </fieldset>

        {/* Industry tags */}
        <fieldset className="border rounded p-2">
          <legend className="text-xs text-gray-500 px-1">行业标签</legend>
          <div className="max-h-32 overflow-y-auto">
            {facets.industryTags.slice(0, 30).map((t) => (
              <label key={t.value} className="flex items-center gap-1 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={params.industryTags.includes(t.value)}
                  onChange={(e) => {
                    const next = e.target.checked
                      ? [...params.industryTags, t.value]
                      : params.industryTags.filter((v) => v !== t.value);
                    updateParam("industryTags", next);
                  }}
                />
                {t.value} <span className="text-gray-400">({t.count})</span>
              </label>
            ))}
          </div>
        </fieldset>

        {/* Seniority */}
        <fieldset className="border rounded p-2">
          <legend className="text-xs text-gray-500 px-1">层级</legend>
          <div className="max-h-28 overflow-y-auto">
            {facets.seniority.map((s) => (
              <label key={s.value} className="flex items-center gap-1 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={params.seniority.includes(s.value)}
                  onChange={(e) => {
                    const next = e.target.checked
                      ? [...params.seniority, s.value]
                      : params.seniority.filter((v) => v !== s.value);
                    updateParam("seniority", next);
                  }}
                />
                {s.value} <span className="text-gray-400">({s.count})</span>
              </label>
            ))}
          </div>
        </fieldset>

        {/* Degree */}
        <fieldset className="border rounded p-2">
          <legend className="text-xs text-gray-500 px-1">最高学历</legend>
          {facets.degrees.map((d) => (
            <label key={d.value} className="flex items-center gap-1 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={params.degree.includes(d.value)}
                onChange={(e) => {
                  const next = e.target.checked
                    ? [...params.degree, d.value]
                    : params.degree.filter((v) => v !== d.value);
                  updateParam("degree", next);
                }}
              />
              {d.value} <span className="text-gray-400">({d.count})</span>
            </label>
          ))}
        </fieldset>

        {/* Age range */}
        <div>
          <label className="text-xs text-gray-500">年龄范围（估算）</label>
          <div className="flex gap-1 items-center">
            <input
              type="number"
              value={params.ageMin}
              onChange={(e) => updateParam("ageMin", e.target.value)}
              placeholder="最小"
              className="w-full border rounded px-2 py-1 text-sm"
              min="0"
            />
            <span className="text-xs text-gray-400">–</span>
            <input
              type="number"
              value={params.ageMax}
              onChange={(e) => updateParam("ageMax", e.target.value)}
              placeholder="最大"
              className="w-full border rounded px-2 py-1 text-sm"
              min="0"
            />
          </div>
        </div>

        {/* Listed company experience */}
        <label className="flex items-center gap-1 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={params.hasListed}
            onChange={(e) => updateParam("hasListed", e.target.checked)}
          />
          有上市公司任职经历
        </label>

        {/* Approx professional background tags */}
        <fieldset className="border rounded p-2">
          <legend className="text-xs text-gray-500 px-1">专业背景（近似匹配）</legend>
          <label className="flex items-center gap-1 text-sm cursor-pointer">
            <input type="checkbox" checked={params.hasCPA} onChange={(e) => updateParam("hasCPA", e.target.checked)} />
            CPA
          </label>
          <label className="flex items-center gap-1 text-sm cursor-pointer">
            <input type="checkbox" checked={params.hasBig4} onChange={(e) => updateParam("hasBig4", e.target.checked)} />
            四大会计所经验
          </label>
          <label className="flex items-center gap-1 text-sm cursor-pointer">
            <input type="checkbox" checked={params.hasIB} onChange={(e) => updateParam("hasIB", e.target.checked)} />
            投行/券商背景
          </label>
          <p className="text-xs text-orange-500 mt-1">
            基于关键词近似匹配简历文本，可能不完全准确，勾选后单页展示数可能少于设定值
          </p>
        </fieldset>

        {/* Disabled placeholder filters — 新数据源暂无这些字段 */}
        <fieldset className="border rounded p-2 opacity-50">
          <legend className="text-xs text-gray-400 px-1">暂无数据（新数据源未采集）</legend>
          <div className="space-y-1 text-sm text-gray-400">
            <div>公司市值</div>
            <div>上市年份</div>
            <div>公司注册地</div>
            <div>性别</div>
            <div>是否上市时在任</div>
          </div>
        </fieldset>

        <button
          onClick={resetParams}
          className="w-full border border-gray-300 text-gray-600 rounded py-1.5 text-sm hover:bg-gray-100"
        >
          重置
        </button>
      </aside>

      {/* ── Right Main Area ── */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <div className="bg-white border-b px-4 py-2 flex items-center justify-between shrink-0">
          <div className="text-sm text-gray-600">
            {loading ? <span>搜索中...</span> : <span>共 {totalCount} 条结果</span>}
          </div>
          <button
            onClick={exportCSV}
            className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700"
          >
            导出 CSV
          </button>
        </div>

        {error && (
          <div className="bg-red-50 border-b border-red-200 text-red-700 text-sm px-4 py-2">{error}</div>
        )}

        <div className="flex-1 overflow-auto">
          <table className="w-full text-sm border-collapse">
            <thead className="bg-gray-100 sticky top-0">
              <tr>
                <Th>公司</Th>
                <Th>代码</Th>
                <Th>板块</Th>
                <Th>姓名</Th>
                <Th>职位</Th>
                <Th>城市</Th>
                <Th>年龄</Th>
                <Th>学历</Th>
                <Th>标签</Th>
                <Th>上市经历</Th>
                <Th>操作</Th>
              </tr>
            </thead>
            <tbody>
              {data.length === 0 && !loading && (
                <tr>
                  <td colSpan={11} className="text-center py-8 text-gray-400">暂无数据</td>
                </tr>
              )}
              {data.map((exec) => (
                <tr key={exec.id} className="border-t hover:bg-blue-50">
                  <td className="px-2 py-1.5 max-w-[140px] truncate" title={exec.company || ""}>{exec.company || "-"}</td>
                  <td className="px-2 py-1.5 font-mono text-xs">{exec.stockCode || "-"}</td>
                  <td className="px-2 py-1.5 text-xs">{exec.exchange}</td>
                  <td className="px-2 py-1.5">{exec.name}</td>
                  <td className="px-2 py-1.5 max-w-[140px] truncate" title={exec.position || ""}>{exec.position || "-"}</td>
                  <td className="px-2 py-1.5">{exec.city || "-"}</td>
                  <td className="px-2 py-1.5">{exec.age != null ? `${exec.age}${exec.ageIsEstimated ? "(估)" : ""}` : "-"}</td>
                  <td className="px-2 py-1.5">{exec.education || "-"}</td>
                  <td className="px-2 py-1.5">
                    <div className="flex gap-1 flex-wrap">
                      {exec.approxCPA && <Tag color="blue">CPA</Tag>}
                      {exec.approxBig4 && <Tag color="green">Big4</Tag>}
                      {exec.approxIB && <Tag color="orange">投行</Tag>}
                    </div>
                  </td>
                  <td className="px-2 py-1.5">{exec.hasListedCompanyExperience ? "✓" : ""}</td>
                  <td className="px-2 py-1.5">
                    <button onClick={() => openDetail(exec)} className="text-blue-600 hover:underline text-xs">详情</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination — cursor 模式，只支持上一页/下一页 */}
        <div className="bg-white border-t px-4 py-2 flex items-center justify-center gap-2 shrink-0">
          <button
            onClick={goPrevPage}
            disabled={currentIndex === 0 || loading}
            className="px-3 py-1 border rounded text-sm disabled:opacity-30"
          >
            上一页
          </button>
          <span className="text-sm text-gray-600">第 {currentIndex + 1} 页</span>
          <button
            onClick={goNextPage}
            disabled={!hasMore || loading}
            className="px-3 py-1 border rounded text-sm disabled:opacity-30"
          >
            下一页
          </button>
        </div>
      </main>

      {/* ── Detail Drawer ── */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/20" onClick={closeDetail} />
          <div className="relative w-full max-w-lg bg-white shadow-xl overflow-y-auto">
            <div className="sticky top-0 bg-white border-b px-4 py-3 flex items-center justify-between z-10">
              <h3 className="font-semibold text-gray-800">
                {selectedExec?.name} · {selectedExec?.company}
              </h3>
              <button onClick={closeDetail} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
            </div>
            {detailLoading && <div className="p-4 text-gray-400 text-sm">加载中...</div>}
            {selectedExec && !detailLoading && (
              <div className="p-4 space-y-4 text-sm">
                <section>
                  <h4 className="font-medium text-gray-600 mb-1">基本信息</h4>
                  <div className="grid grid-cols-2 gap-1 text-gray-700">
                    <Info label="姓名" value={selectedExec.name} />
                    <Info label="城市" value={selectedExec.city || "-"} />
                    <Info label="年龄" value={selectedExec.age != null ? String(selectedExec.age) : "-"} />
                    <Info label="公司" value={selectedExec.company || "-"} />
                    <Info label="职位" value={selectedExec.position || "-"} />
                    <Info label="板块" value={selectedExec.exchange} />
                    <Info label="学历" value={selectedExec.education || "-"} />
                    <Info label="院校" value={selectedExec.school || "-"} />
                    <Info label="专业" value={selectedExec.major || "-"} />
                  </div>
                </section>

                {selectedExec.stockCodes.length > 0 && (
                  <section>
                    <h4 className="font-medium text-gray-600 mb-1">上市公司任职（股票代码）</h4>
                    <div className="flex gap-2 flex-wrap">
                      {selectedExec.stockCodes.map((code) => (
                        <Tag key={code} color="pink">{code}</Tag>
                      ))}
                    </div>
                  </section>
                )}

                <section>
                  <h4 className="font-medium text-gray-600 mb-1">专业标签（近似匹配，可能不完全准确）</h4>
                  <div className="flex gap-2 flex-wrap">
                    {selectedExec.approxCPA && <Tag color="blue">CPA</Tag>}
                    {selectedExec.approxBig4 && <Tag color="green">Big4</Tag>}
                    {selectedExec.approxIB && <Tag color="orange">投行/券商</Tag>}
                    {!selectedExec.approxCPA && !selectedExec.approxBig4 && !selectedExec.approxIB && (
                      <span className="text-xs text-gray-400">
                        近似匹配仅在左侧勾选对应筛选后，于列表页计算标记；详情页本身不单独判断，此处留空不代表未命中
                      </span>
                    )}
                  </div>
                </section>

                {selectedExec.industryTags.length > 0 && (
                  <section>
                    <h4 className="font-medium text-gray-600 mb-1">行业 / 技能标签</h4>
                    <div className="flex gap-1 flex-wrap">
                      {selectedExec.industryTags.map((t) => <Tag key={t} color="purple">{t}</Tag>)}
                      {selectedExec.skillTags.map((t) => <Tag key={t} color="blue">{t}</Tag>)}
                    </div>
                  </section>
                )}

                {selectedExec.companies.length > 0 && (
                  <section>
                    <h4 className="font-medium text-gray-600 mb-1">工作经历（{selectedExec.companies.length} 条）</h4>
                    <div className="space-y-2">
                      {selectedExec.companies.map((c, i) => (
                        <div key={i} className="border rounded p-2 text-xs">
                          <div className="flex justify-between text-gray-500 mb-1">
                            <span>{c.start || "?"} → {c.end || "至今"}</span>
                            {c.company && <span className="font-medium text-gray-700">{c.company}</span>}
                          </div>
                          {c.title && <p className="text-gray-600">{c.title}</p>}
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {selectedExec.schools.length > 0 && (
                  <section>
                    <h4 className="font-medium text-gray-600 mb-1">教育经历</h4>
                    <div className="space-y-2">
                      {selectedExec.schools.map((s, i) => (
                        <div key={i} className="border rounded p-2 text-xs text-gray-600">
                          {s.school} {s.degree ? `· ${s.degree}` : ""} {s.major ? `· ${s.major}` : ""}
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {selectedExec.summaryProfile && (
                  <section>
                    <h4 className="font-medium text-gray-600 mb-1">人才画像摘要</h4>
                    <p className="text-gray-700 whitespace-pre-wrap text-xs leading-relaxed bg-gray-50 rounded p-2">
                      {selectedExec.summaryProfile}
                    </p>
                  </section>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Small reusable components ──

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-2 py-1.5 text-left text-xs font-medium text-gray-500 uppercase">
      {children}
    </th>
  );
}

function Tag({ children, color }: { children: React.ReactNode; color: string }) {
  const colors: Record<string, string> = {
    blue: "bg-blue-100 text-blue-700",
    green: "bg-green-100 text-green-700",
    purple: "bg-purple-100 text-purple-700",
    orange: "bg-orange-100 text-orange-700",
    pink: "bg-pink-100 text-pink-700",
  };
  return <span className={`inline-block px-1.5 py-0.5 rounded text-xs font-medium ${colors[color] || colors.blue}`}>{children}</span>;
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-1">
      <span className="text-gray-400 shrink-0">{label}:</span>
      <span className="text-gray-700 truncate" title={value}>{value}</span>
    </div>
  );
}
