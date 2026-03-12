import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function GET() {
  const cwd = process.cwd();
  const candidates = [
    path.join(cwd, "data.json"),
    path.join(cwd, "web", "data.json"),
    path.join(__dirname, "../../../../data.json"),
    path.join(__dirname, "../../../../../data.json"),
  ];

  const info = candidates.map((p) => ({
    path: p,
    exists: fs.existsSync(p),
  }));

  return NextResponse.json({ cwd, __dirname, candidates: info });
}
