# 上市公司高管信息搜索器 — 项目总纲

## 项目简介

一个内部使用的高管搜索工具，支持按行业、板块、市值、职位等维度筛选 A 股 + 港股上市公司高管，
并展示人选的基本信息与公开履历。

- **线上地址**：https://executive-search-flame.vercel.app/search
- **部署平台**：Vercel（自动从 GitHub main 分支部署）
- **GitHub 仓库**：https://github.com/liuqianmeiguo-prog/executive-search
- **当前分支**：formidable-hornet-ac9637（本地工作分支，推送到远端 main）

---

## 数据现状

| 文件 | 大小 | 记录数 | 说明 |
|------|------|--------|------|
| `web/data.json` | 35MB | 34,219 | **线上使用的正式数据**，含履历字段 |
| `web/data.json.bak` | 15MB | 34,219 | 旧版备份（无履历），可用于回滚 |
| `data.json`（根目录） | 29MB | 34,219 | 中间版本，可忽略 |

**数据来源**：通过 `update_data.py` 脚本从 iFinD API 拉取，合并了乾坤数据（含 `publicResumeRaw` 履历字段）。

**关键字段**：
- `publicResumeRaw`：原始履历文字（25,035 条有数据），前端自动解析为时间轴展示
- `careerItems`：结构化工作经历（目前全部为空，暂时用 publicResumeRaw 替代）

---

## 数据流向

```
web/data.json（构建时静态打包）
    ↓
web/src/lib/data.ts → getAllData() / searchData()
    ↓
/api/data      → 返回全量数据（登录后可访问）
/api/search    → 服务端筛选 + 分页
/api/filters   → 返回筛选选项（行业、板块等）
    ↓
web/public/search.html（前端页面，在浏览器做展示）
```

---

## 核心文件目录

```
federal-timber/
├── web/                          ← Next.js 应用主目录
│   ├── data.json                 ← ⭐ 正式数据文件（35MB，构建时打包）
│   ├── data.json.bak             ← 旧版数据备份
│   ├── next.config.ts            ← Next.js 配置（当前为空配置）
│   ├── public/
│   │   └── search.html           ← ⭐ 前端搜索页（表格/筛选/履历弹窗）
│   └── src/
│       ├── app/
│       │   ├── login/page.tsx    ← 登录页
│       │   ├── search/route.ts   ← /search 路由（鉴权后返回 search.html）
│       │   └── api/
│       │       ├── auth/         ← NextAuth 登录接口
│       │       ├── data/route.ts ← 全量数据接口（需登录）
│       │       ├── search/route.ts ← 搜索接口（支持筛选分页）
│       │       └── filters/route.ts ← 筛选选项接口
│       └── lib/
│           ├── auth.ts           ← ⭐ 鉴权配置（用户名+密码，存环境变量）
│           └── data.ts           ← ⭐ 数据层（静态import + 查询函数）
│
├── update_data.py                ← iFinD API 数据拉取脚本
├── update.sh                     ← 数据更新入口脚本
├── 高管信息搜索器.html            ← 早期单文件版本（已存档）
└── docs/
    └── project/
        └── overview.md           ← 本文件
```

---

## 鉴权机制

- 方式：用户名 + 密码（NextAuth Credentials）
- 账号配置：Vercel 环境变量 `AUTH_USERS`，格式为 `用户名:密码,用户名:密码`
- Session 有效期：8 小时
- 未登录访问 `/search` → 自动跳转 `/login`

---

## 前端功能（search.html）

| 功能 | 状态 |
|------|------|
| 按行业/板块/市值/职位/姓名/公司筛选 | ✅ 已上线 |
| 排序（点击表头） | ✅ 已上线 |
| 分页 | ✅ 已上线 |
| 收藏筛选方案 | ✅ 已上线 |
| 导出 Excel | ✅ 已上线 |
| 详情抽屉（基本信息/教育背景） | ✅ 已上线 |
| 人选履历弹窗（解析时间轴） | ✅ 已上线（2026-03-19） |
| 飞书招聘匹配 | 🔲 待接入（API 权限审批中） |

---

## 待办事项

- [ ] 飞书招聘 API 接入（展示人选是否已在飞书招聘中有记录）
- [ ] 数据定期自动更新（GitHub Actions 定时触发 update_data.py）
- [ ] 履历解析优化（careerItems 字段结构化，目前用 publicResumeRaw 文字解析）
- [ ] 性能优化：列表接口轻量返回，详情接口单独拉取履历（数据量大时备用）

---

## 常见操作

### 更新数据并部署
```bash
# 1. 运行 iFinD 脚本生成新 data.json
python update_data.py

# 2. 覆盖正式数据文件
cp data.json web/data.json

# 3. 提交并推送（Vercel 自动部署）
git add web/data.json
git commit -m "更新数据"
git push origin HEAD:main
```

### 紧急回滚数据
```bash
cp web/data.json.bak web/data.json
git add web/data.json && git commit -m "回滚数据" && git push origin HEAD:main
```
