import { auth } from "@/lib/auth";
import { searchData } from "@/lib/data";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sp = req.nextUrl.searchParams;

  const params = {
    name: sp.get("name") || undefined,
    company: sp.get("company") || undefined,
    exchange: sp.getAll("exchange").filter(Boolean),
    industry: sp.getAll("industry").filter(Boolean),
    subIndustry: sp.getAll("subIndustry").filter(Boolean),
    position: sp.get("position") || undefined,
    capMin: sp.get("capMin") ? Number(sp.get("capMin")) : undefined,
    capMax: sp.get("capMax") ? Number(sp.get("capMax")) : undefined,
    page: sp.get("page") ? Number(sp.get("page")) : 1,
    pageSize: sp.get("pageSize") ? Math.min(Number(sp.get("pageSize")), 200) : 50,
  };

  const result = await searchData(params);
  return NextResponse.json(result);
}
