#!/bin/bash
# 一键更新：拉取 iFinD 数据 → 生成 data.json → 推送 GitHub → 网页自动更新
set -e
cd "$(dirname "$0")"

echo ""
echo "═══════════════════════════════════════════"
echo "  🚀 一键更新上市公司高管数据"
echo "═══════════════════════════════════════════"
echo ""

# 0. 加载本地环境变量
if [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
fi

# 1. 拉取数据并生成 data.json
echo "📡 第1步：从 iFinD 拉取数据..."
python3 update_data.py

# 2. 推送到 GitHub
echo ""
echo "📤 第2步：推送到 GitHub..."
git add data.json
git commit -m "更新高管数据 $(date '+%Y-%m-%d')"
git push

echo ""
echo "═══════════════════════════════════════════"
echo "  ✅ 全部完成！网页将在 1-2 分钟后自动更新"
echo "  🔗 https://liuqianmeiguo-prog.github.io/executive-search/高管信息搜索器.html"
echo "═══════════════════════════════════════════"
