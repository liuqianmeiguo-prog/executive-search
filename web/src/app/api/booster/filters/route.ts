import { auth } from "@/lib/auth";
import { getFacets } from "@/lib/booster";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const facets = await getFacets(50);
    return NextResponse.json(facets, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (e) {
    console.error("BoosterTalents 筛选项获取失败:", e);
    return NextResponse.json({ error: "获取筛选项失败" }, { status: 502 });
  }
}
