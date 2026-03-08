import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 允许读取项目根目录（data.json 在 web/ 的上级目录）
  // 注意：Vercel 部署时需要把 data.json 放在 web/ 目录内
  serverExternalPackages: [],
};

export default nextConfig;
