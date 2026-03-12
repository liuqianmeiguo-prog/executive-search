import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 确保 data.json 被打包进 Vercel Serverless 函数
  outputFileTracingIncludes: {
    "/**": ["./data.json"],
  },
};

export default nextConfig;
