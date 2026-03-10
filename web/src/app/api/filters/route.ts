import { auth } from "@/lib/auth";
import { getFilterOptions } from "@/lib/data";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const options = await getFilterOptions();
  return NextResponse.json(options);
}
