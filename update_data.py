#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
update_data.py — 高管信息自动更新脚本
======================================
从同花顺 iFinD HTTP API (quantapi.10jqka.com.cn) 拉取全量 A 股高管数据，
自动注入到 HTML 搜索工具中。

用法：
    python update_data.py              # 自动拉取所有 A 股
    python update_data.py codes.txt   # 从文件指定股票代码（每行一个，如 600519.SH）
    python update_data.py --test      # 测试模式（仅拉取前 10 只，验证 API 连通）

依赖（安装一次）：
    pip install requests
"""

import sys
import json
import re
import time
import os
from pathlib import Path
from datetime import datetime

import requests

# ══════════════════════════════════════════════════════════════
#  ① 配置区 — 填写你的 API 信息
# ══════════════════════════════════════════════════════════════

CONFIG = {
    # iFinD API 基础地址
    "api_base": "https://quantapi.51ifind.com",

    # 认证 — 二选一：
    #   方式 A：直接填 access_token（在 iFinD 后台/API 文档里获取）
    "token": os.environ.get("IFIND_TOKEN", ""),

    #   方式 B：用户名 + 密码（脚本会自动登录获取 token）
    "username": "",
    "password": "",

    # 输出的 HTML 文件路径（和本脚本放在同一目录）
    "html_path": "高管信息搜索器.html",

    # 每批查询股票数（建议 100-300）
    "batch_size": 200,

    # 批次间隔（秒），避免触发 API 频率限制
    "batch_delay": 0.3,
}

# ══════════════════════════════════════════════════════════════
#  ② iFinD 指标代码
#  ⚠️  如果 API 报"指标不存在"，请对照你的 API 文档修改下面的代码
# ══════════════════════════════════════════════════════════════

# 格式：(指标名, indiparams)
# indiparams 说明：["1", "日期"] = 行业类型+截止日期；["100"] = 最多返回100条（高管多值字段）
_TODAY = datetime.now().strftime("%Y-%m-%d")

BASIC_INDICATORS = [
    ("ths_corp_cn_name_stock",          [""]),           # 公司中文名称
    ("ths_ipo_date_stock",              [""]),           # 首发上市日期
    ("ths_listedsector_stock",          [""]),           # 上市板块
    ("ths_the_sw_industry_stock",       ["1", _TODAY]),  # 申万一级行业
    ("ths_prefecture_level_city_stock", [""]),           # 地级市
    ("ths_market_value_stock",          [_TODAY]),       # 总市值（元）
]

# 申万二级行业（同名指标不同参数，需单独请求）
SW_LEVEL2_INDICATOR = ("ths_the_sw_industry_stock", ["2", _TODAY])

MGMT_INDICATORS = [
    ("ths_cfo_current_stock",                  [""]),    # 财务总监（现任）— 注意用 ths_cfo_current_stock
    ("ths_general_managercurrent_stock",       [""]),    # 总经理（现任）
    ("ths_secretary_current_stock",            [""]),    # 董事会秘书（现任）
    ("ths_vice_general_manager_current_stock", ["100"]), # 副总经理（现任）
    ("ths_cfo_his_stock",                      ["100"]), # 财务总监（历任）
    ("ths_general_manager_his_stock",          ["100"]), # 总经理（历任）
    ("ths_secretary_his_stock",                ["100"]), # 董事会秘书（历任）
    ("ths_vice_general_manager_his_stock",     ["100"]), # 副总经理（历任）
    ("ths_sm_name_current_stock",              ["100"]), # 高管姓名（现任，多值）
    ("ths_sm_sex_current_stock",               ["100"]), # 高管性别（现任，多值）
    ("ths_birth_year_current_stock",           ["100"]), # 出生年份（现任，多值）
    ("ths_sm_edu_current_stock",               ["100"]), # 高管学历（现任，多值）
]

# ══════════════════════════════════════════════════════════════
#  API 调用层
# ══════════════════════════════════════════════════════════════

_session = requests.Session()
_session.headers.update({
    "Content-Type": "application/json",
    "Accept": "application/json",
})


def login():
    """
    设置 API 认证 access_token。
    CONFIG["token"] 直接填 access_token（7天有效期，过期后去 iFinD 网页版重新获取）。
    """
    if CONFIG["token"]:
        _session.headers["access_token"] = CONFIG["token"]
        print("✅ 使用配置的 access_token")
        return

    if not CONFIG["username"] or not CONFIG["password"]:
        raise RuntimeError(
            "❌ 请在 CONFIG 中填写 token（refresh_token）或 username+password"
        )

    url = f"{CONFIG['api_base']}/app/auth/login"
    resp = _session.post(url, json={
        "user":   CONFIG["username"],
        "passwd": CONFIG["password"],
    }, timeout=10)
    resp.raise_for_status()
    data = resp.json()

    if data.get("errorcode", 0) != 0:
        raise RuntimeError(f"登录失败: {data.get('errmsg', data)}")

    token = (data.get("accesstoken")
             or data.get("access_token")
             or data.get("token")
             or "")
    if not token:
        raise RuntimeError(
            f"登录成功但未找到 token，API 响应：{json.dumps(data, ensure_ascii=False)}\n"
            "请检查你的 API 文档，确认 token 字段名。"
        )

    _session.headers["access_token"] = token
    print("✅ 登录成功")


def _call_api(codes: list, indicators: list) -> dict:
    """
    调用 iFinD 批量数据接口，返回 {STOCK_CODE: {field: value}} 字典。

    ⚠️  如果报 404 / 接口不存在，请对照你的 API 文档修改：
        1. url 路径（可能是 /api/v1/ths_bd 或 /api/v1/stockindicators 等）
        2. payload 字段名（thscode / codes / stockCode 等）
        3. 响应解析（tables / data / result 等）
    """
    url = f"{CONFIG['api_base']}/api/v1/basic_data_service"

    # indicators 格式：[(名称, indiparams), ...]
    payload = {
        "codes":    ",".join(codes),
        "indipara": [{"indicator": name, "indiparams": params}
                     for name, params in indicators],
    }

    resp = _session.post(url, json=payload, timeout=30)
    resp.raise_for_status()
    data = resp.json()

    ec = data.get("errorcode", 0)
    if ec != 0:
        msg = data.get("errmsg", str(data))
        raise RuntimeError(f"API 返回错误 {ec}: {msg}")

    tables = data.get("tables") or []

    result = {}
    for row in tables:
        code = (row.get("thscode") or row.get("code") or "").upper()
        if not code:
            continue
        # 数据在 row["table"] 子字典里，值为列表
        # 多值字段（高管姓名/性别等）用分号合并，单值字段直接取值
        table_data = row.get("table") or row.get("data") or {}
        flat = {}
        for k, v in table_data.items():
            if isinstance(v, list):
                clean = [str(x).strip() for x in v if x is not None and str(x).strip()]
                flat[k] = ";".join(clean)
            else:
                flat[k] = str(v).strip() if v else ""
        result[code] = flat
    return result


def fetch_all(codes: list, indicators: list, label: str) -> dict:
    """分批拉取所有股票，带进度显示"""
    n = CONFIG["batch_size"]
    batches = [codes[i:i + n] for i in range(0, len(codes), n)]
    total = len(batches)
    all_data = {}

    for i, batch in enumerate(batches, 1):
        print(f"  [{i:>4}/{total}] {label}... ", end="", flush=True)
        try:
            result = _call_api(batch, indicators)
            all_data.update(result)
            print(f"✓ (+{len(result)})")
        except Exception as e:
            print(f"⚠ 跳过（{e}）")

        if i < total:
            time.sleep(CONFIG["batch_delay"])

    print(f"  → {label} 完成，共 {len(all_data)} 条记录")
    return all_data


def get_all_ashare_codes() -> list:
    """
    获取全量 A 股代码列表，按优先级尝试以下方法：
    方法1：akshare（免费开源，实时更新，覆盖全市场）
    方法2：从本地 codes.txt 文件读取（手动维护备用）
    """
    # ── 方法1：akshare 拉取全量 A 股 ────────────────────────────────
    try:
        print("  → 尝试 akshare 拉取全量A股代码...")
        import akshare as ak

        # 沪深 A 股
        df = ak.stock_info_a_code_name()   # 返回 DataFrame，含 code / name 列
        result = []
        if df is not None and not df.empty:
            code_col = df.columns[0]
            raw_codes = df[code_col].astype(str).tolist()
            for c in raw_codes:
                c = c.strip().zfill(6)
                if c.startswith("6") or c.startswith("5"):
                    result.append(f"{c}.SH")
                elif c.startswith("0") or c.startswith("2") or c.startswith("3"):
                    result.append(f"{c}.SZ")
        # 北交所
        try:
            df_bj = ak.stock_info_bj_name_code()
            if df_bj is not None and not df_bj.empty:
                bj_col = df_bj.columns[0]  # "证券代码"
                for c in df_bj[bj_col].astype(str).tolist():
                    c = c.strip().zfill(6)
                    result.append(f"{c}.BJ")
                print(f"  → 其中北交所 {len(df_bj)} 只")
        except Exception as e:
            print(f"  → 北交所代码获取失败（跳过）：{e}")
        result = sorted(set(result))
        if result:
            print(f"  → 获取到 {len(result)} 只 A 股代码（含北交所）")
            return result
    except ImportError:
        print("  → akshare 未安装，跳过（可运行 pip3 install akshare 安装）")
    except Exception as e:
        print(f"  → akshare 拉取失败：{e}")

    # ── 方法2：从本地文件读取 ────────────────────────────────────────
    codes_file = Path("codes.txt")
    if codes_file.exists():
        codes = [l.strip() for l in codes_file.read_text(encoding="utf-8").splitlines()
                 if l.strip() and not l.startswith("#")]
        print(f"  → 从 codes.txt 读取 {len(codes)} 个代码")
        return codes

    raise RuntimeError(
        "\n❌ 无法自动获取股票代码列表，且未找到 codes.txt。\n\n"
        "解决方法（二选一）：\n"
        "  1. 安装 akshare：pip3 install akshare\n"
        "  2. 手动新建 codes.txt，每行一个股票代码，例如：\n"
        "  600519.SH\n  300750.SZ\n  688981.SH\n  430047.BJ\n"
        "然后重新运行：python update_data.py codes.txt"
    )


# ══════════════════════════════════════════════════════════════
#  数据转换层
# ══════════════════════════════════════════════════════════════

def _v(row: dict, *field_names) -> str:
    """大小写不敏感地从字典中取第一个有值的字段"""
    row_lower = {k.lower(): v for k, v in row.items()}
    for name in field_names:
        val = row_lower.get(name.lower(), "")
        s = str(val).strip()
        if s and s not in ("-", "--", "nan", "None", "null"):
            return s
    return ""


def _normalize_exchange(raw: str, code: str) -> str:
    r = raw.strip()
    if "科创" in r:                                          return "A股科创板"
    if "创业" in r:                                          return "A股创业板"
    if "北证" in r or "北交" in r or code.endswith(".BJ"):  return "A股北交所"
    if code.endswith(".BJ"):                                 return "A股北交所"
    if code.endswith(".SH"):
        num = int(code[:6]) if code[:6].isdigit() else 0
        return "A股科创板" if 688000 <= num <= 688999 else "A股主板"
    if code.endswith(".SZ"):
        num = int(code[:6]) if code[:6].isdigit() else 0
        return "A股创业板" if 300000 <= num <= 301999 else "A股主板"
    return "A股主板"


def _parse_year(v) -> int | None:
    if not v:
        return None
    s = str(v).strip()
    if len(s) >= 8 and s[:8].isdigit():
        return int(s[:4])
    m = re.match(r"(\d{4})", s)
    return int(m.group(1)) if m else None


def _split(v: str) -> list:
    if not v:
        return []
    return [s.strip() for s in re.split(r"[;；,，]", str(v)) if s.strip()]


def build_person_rows(stock_code: str, basic: dict, mgmt: dict) -> list:
    """将单家公司的 basic + mgmt 字典转换为高管记录列表"""
    company_name = _v(basic, "ths_corp_cn_name_stock")
    if not company_name:
        return []

    exchange     = _normalize_exchange(_v(basic, "ths_listedsector_stock"), stock_code)
    listing_year = _parse_year(_v(basic, "ths_ipo_date_stock"))
    industry     = _v(basic, "ths_the_sw_industry_stock") or ""
    sub_industry = _v(basic, "sw_industry_lv2") or ""
    # 去掉申万二级行业名称中的罗马数字后缀（如 "白酒Ⅱ" → "白酒"）
    sub_industry = re.sub(r"[ⅠⅡⅢⅣⅤⅥⅦⅧⅨⅩ]+$", "", sub_industry).strip()
    reg_loc      = _v(basic, "ths_prefecture_level_city_stock")
    display_code = re.sub(r"\.(SH|SZ|BJ)$", "", stock_code, flags=re.IGNORECASE)

    # 市值（API 返回单位为元，转为亿元）
    raw_cap = _v(basic, "ths_market_value_stock")
    try:
        market_cap = round(float(raw_cap) / 1e8, 1) if raw_cap else None
    except (ValueError, TypeError):
        market_cap = None

    # 高管并行数组（多值字段，分号分隔）
    name_list   = _split(_v(mgmt, "ths_sm_name_current_stock"))
    gender_list = _split(_v(mgmt, "ths_sm_sex_current_stock"))
    birth_list  = _split(_v(mgmt, "ths_birth_year_current_stock"))
    edu_list    = _split(_v(mgmt, "ths_sm_edu_current_stock"))

    def get_attr(name: str) -> dict:
        try:
            idx = name_list.index(name)
        except ValueError:
            return {"gender": "", "birth_year": 0, "education": ""}
        return {
            "gender":     "男" if gender_list[idx:idx+1] == ["男"] else
                          "女" if gender_list[idx:idx+1] == ["女"] else "",
            "birth_year": int(birth_list[idx]) if idx < len(birth_list)
                          and birth_list[idx].isdigit() else 0,
            "education":  edu_list[idx] if idx < len(edu_list) else "",
        }

    cur_year = datetime.now().year
    rows, seen = [], set()

    # (现任字段, 历任字段, 职位名, 是否多值)
    pos_fields = [
        ("ths_cfo_current_stock",                  "ths_cfo_his_stock",                  "财务总监",  False),
        ("ths_general_managercurrent_stock",       "ths_general_manager_his_stock",       "总经理",    False),
        ("ths_secretary_current_stock",            "ths_secretary_his_stock",             "董事会秘书", False),
        ("ths_vice_general_manager_current_stock", "ths_vice_general_manager_his_stock",  "副总经理",  True),
    ]

    for cur_field, his_field, position, multi in pos_fields:
        raw   = _v(mgmt, cur_field)
        names = _split(raw) if multi else ([raw] if raw else [])
        # 历任名单（已卸任的人）
        his_names = set(_split(_v(mgmt, his_field)))
        # 判断逻辑：如果该职位历任为空，说明现任从上市起就在任
        # 如果历任不为空，则现任是后来接替的（非上市时在任）
        is_ipo = len(his_names) == 0

        for name in names:
            if not name or name in seen:
                continue
            seen.add(name)
            attr = get_attr(name)
            age  = cur_year - attr["birth_year"] if attr["birth_year"] else None

            rows.append({
                "industry":          industry or "—",
                "subIndustry":       sub_industry or "—",
                "stockCode":         display_code,
                "companyName":       company_name,
                "exchange":          exchange,
                "listingYear":       listing_year,
                "marketCapValue":    market_cap,
                "marketCapCurrency": "CNY",
                "registrationLoc":   reg_loc,
                "name":              name,
                "location":          reg_loc,
                "position":          position,
                "background":        attr["education"] or "",
                "linkedin":          "",
                "isIPOServing":      is_ipo,
                "age":               age,
                "gender":            attr["gender"],
                "hasCPA":            False,
                "hasIB":             False,
                "education": (
                    [{"school": "", "degree": attr["education"],
                      "major": "", "year": ""}]
                    if attr["education"] else []
                ),
                "careerItems": [],
                "highlights":  [],
            })

    return rows


# ══════════════════════════════════════════════════════════════
#  数据输出
# ══════════════════════════════════════════════════════════════

def save_data_json(rows: list):
    """将数据保存为 data.json（供 HTML 异步加载）"""
    out = Path("data.json")
    with open(out, "w", encoding="utf-8") as f:
        json.dump(rows, f, ensure_ascii=False, separators=(",", ":"))
    size_mb = out.stat().st_size / 1024 / 1024
    print(f"  ✅ data.json 已更新（{size_mb:.1f} MB）")


# ══════════════════════════════════════════════════════════════
#  主流程
# ══════════════════════════════════════════════════════════════

def main():
    test_mode = "--test" in sys.argv
    codes_arg = next((a for a in sys.argv[1:] if not a.startswith("-")), None)

    print("=" * 56)
    print("  🔍 高管信息数据更新脚本")
    print(f"  {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    if test_mode:
        print("  ⚡ 测试模式（仅拉取前 10 只）")
    print("=" * 56)

    # ── 1. 认证
    print("\n[1/5] 登录 iFinD API...")
    login()

    # ── 2. 获取股票代码
    print("\n[2/5] 获取股票代码列表...")
    if codes_arg and Path(codes_arg).exists():
        codes = [l.strip() for l in
                 Path(codes_arg).read_text(encoding="utf-8").splitlines()
                 if l.strip() and not l.startswith("#")]
        print(f"  → 从 {codes_arg} 读取 {len(codes)} 个代码")
    else:
        codes = get_all_ashare_codes()

    if test_mode:
        codes = codes[:10]
        print(f"  → 测试模式：仅使用 {codes}")

    print(f"  → 共 {len(codes)} 只股票待处理")

    # ── 3. 拉取基本信息
    print("\n[3/6] 拉取公司基本信息...")
    basic_map = fetch_all(codes, BASIC_INDICATORS, "基本信息")

    # ── 3b. 拉取申万二级行业（同名指标不同参数，需单独请求）
    print("\n[4/6] 拉取申万二级行业...")
    sw2_map = fetch_all(codes, [SW_LEVEL2_INDICATOR], "申万二级")
    # 合并到 basic_map，字段名加 _lv2 后缀以区分
    for code, data in sw2_map.items():
        val = data.get("ths_the_sw_industry_stock", "")
        basic_map.setdefault(code, {})["sw_industry_lv2"] = val

    # ── 5. 拉取高管信息
    print("\n[5/6] 拉取高管信息...")
    mgmt_map = fetch_all(codes, MGMT_INDICATORS, "高管信息")

    # ── 6. 转换 & 写入
    print("\n[6/6] 转换数据并写入 JSON...")
    all_codes = sorted(set(list(basic_map) + list(mgmt_map)))
    all_rows, skipped = [], 0

    for code in all_codes:
        rows = build_person_rows(
            code,
            basic_map.get(code, {}),
            mgmt_map.get(code, {}),
        )
        if rows:
            all_rows.extend(rows)
        else:
            skipped += 1

    companies = len({r["companyName"] for r in all_rows})
    print(f"  → 生成 {len(all_rows)} 条高管记录（{companies} 家公司，跳过 {skipped} 家无数据）")

    if not test_mode:
        save_data_json(all_rows)
    else:
        print("  ℹ️  测试模式：不写入 HTML，前 3 条样本数据：")
        for r in all_rows[:3]:
            print(f"    {r['stockCode']}  {r['companyName']}  {r['name']}  {r['position']}")

    print("\n" + "=" * 56)
    print(f"  ✅ 完成！{len(all_rows)} 条记录 / {companies} 家公司")
    print("=" * 56)


if __name__ == "__main__":
    main()
