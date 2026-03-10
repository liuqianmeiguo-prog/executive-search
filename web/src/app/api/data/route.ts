import { auth } from "@/lib/auth";
import { getAllData } from "@/lib/data";
import { NextResponse } from "next/server";

// 返回完整数据集（仅登录用户可访问）
// data.json 不放在 public 目录，只能通过此 API 获取
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const data = await getAllData();
  return NextResponse.json(data, {
    headers: {
      // 禁止浏览器缓存，每次都验证登录状态
      "Cache-Control": "no-store",
    },
  });
}
