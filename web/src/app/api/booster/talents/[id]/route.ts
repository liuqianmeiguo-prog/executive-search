import { auth } from "@/lib/auth";
import { getTalentDetail } from "@/lib/booster";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  }

  const includeResume = req.nextUrl.searchParams.get("includeResume") === "true";

  try {
    const detail = await getTalentDetail(id, { includeResume });
    return NextResponse.json(detail, { headers: { "Cache-Control": "no-store" } });
  } catch (e: unknown) {
    const status = (e as { status?: number })?.status;
    if (status === 404) {
      return NextResponse.json({ error: "未找到该人才" }, { status: 404 });
    }
    console.error("BoosterTalents 详情获取失败:", e);
    return NextResponse.json({ error: "获取详情失败" }, { status: 502 });
  }
}
