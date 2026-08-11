import { auth } from "@/lib/auth";
import { applyApproxTagFilters, searchTalents } from "@/lib/booster";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sp = req.nextUrl.searchParams;

  const q = sp.get("q") || sp.get("companyName") || sp.get("name") || undefined;
  const city = sp.getAll("city").filter(Boolean);
  const industryTags = sp.getAll("industryTags").filter(Boolean);
  const seniority = sp.getAll("seniority").filter(Boolean);
  const degree = sp.getAll("degree").filter(Boolean);
  const hasListed = sp.get("hasListed") === "true";
  const ageMin = sp.get("ageMin") ? Number(sp.get("ageMin")) : undefined;
  const ageMax = sp.get("ageMax") ? Number(sp.get("ageMax")) : undefined;
  const cursor = sp.get("cursor") || null;
  const limit = sp.get("limit") ? Math.min(100, Math.max(1, Number(sp.get("limit")))) : 50;

  const hasCPA = sp.get("hasCPA") === "true";
  const hasBig4 = sp.get("hasBig4") === "true";
  const hasIB = sp.get("hasIB") === "true";

  const baseParams = { q, city, industryTags, seniority, degree, hasListed, ageMin, ageMax };

  try {
    const result = await searchTalents({ ...baseParams, cursor, limit, match: "all" });

    const data = await applyApproxTagFilters(result.data, baseParams, { hasCPA, hasBig4, hasIB });

    return NextResponse.json(
      {
        data,
        totalCount: result.totalCount,
        nextCursor: result.nextCursor,
        hasMore: result.hasMore,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (e) {
    console.error("BoosterTalents 搜索失败:", e);
    return NextResponse.json({ error: "搜索失败，请稍后重试" }, { status: 502 });
  }
}
