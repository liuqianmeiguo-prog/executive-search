import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

// GET /search → 返回搜索页 HTML（只有登录用户可访问）
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.redirect(new URL("/login?callbackUrl=/search", process.env.NEXTAUTH_URL || "http://localhost:3000"));
  }

  const htmlPath = path.join(process.cwd(), "public", "search.html");
  const html = fs.readFileSync(htmlPath, "utf-8");

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
