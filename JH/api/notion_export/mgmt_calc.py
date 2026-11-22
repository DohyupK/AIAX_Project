"""일일 경영 리포트 집계 — 프론트 logic.ts buildReport / computeReport / compareReport 와 동일"""
from __future__ import annotations

from typing import Any

GEARS = ("helmet", "shoes", "vest", "gloves", "goggles")
GEAR_LABEL = {
    "helmet": "안전모",
    "shoes": "안전화",
    "vest": "조끼",
    "gloves": "장갑",
    "goggles": "보안경",
}
FIXED_NAME = {
    "unitPrice": "제품_단가",
    "recycleValue": "재활용_회수액",
    "recycleRate": "재활용률",
    "mttr": "MTTR",
    "mtbf": "MTBF",
    "recall": "리콜_횟수_12개월",
}


def ratio(n: float, d: float) -> float | None:
    return (n / d) if d else None


def pick_fixed(rows: list[dict[str, Any]], date: str) -> dict[str, float | None]:
    def at(name: str) -> float | None:
        best = None
        for r in rows:
            if r["name"] == name and r["effectiveDate"] <= date and (best is None or r["effectiveDate"] >= best["effectiveDate"]):
                best = r
        return float(best["value"]) if best else None

    return {k: at(name) for k, name in FIXED_NAME.items()}


def _safety_of(data: dict[str, Any], in_range) -> dict[str, Any]:
    v = [x for x in data["violations"] if in_range(x["date"])]
    per_user: dict[str, int] = {}
    per_company: dict[str, dict[str, Any]] = {}
    by_gear = {g: 0 for g in GEARS}
    for x in v:
        per_user[x["userId"]] = per_user.get(x["userId"], 0) + 1
        key = f"{x['vendor']}|{x['company']}"
        c = per_company.get(key) or {"company": x["company"], "type": "하청업체" if x["vendor"] else "본사", "count": 0}
        c["count"] += 1
        per_company[key] = c
        for g in x.get("missing") or []:
            if g in by_gear:
                by_gear[g] += 1
    return {
        "scans": sum(x["count"] for x in data["scans"] if in_range(x["date"])),
        "violations": len(v),
        "repeatViolators": sum(1 for n in per_user.values() if n >= 2),
        "byCompany": list(per_company.values()),
        "byGear": by_gear,
    }


def build_report(src: dict[str, Any], from_d: str, to_d: str) -> dict[str, Any]:
    def in_range(d: str) -> bool:
        return from_d <= d <= to_d

    def sm(rows: list[dict], key: str) -> int:
        return sum(int(r[key]) for r in rows if in_range(r["date"]))

    return {
        "fixed": pick_fixed(src["fixed"], to_d),
        "noData": not any(in_range(d["date"]) for d in src["daily"]),
        "production": sm(src["daily"], "production"),
        "defects": sm(src["daily"], "defects"),
        "spcAlarms": {"ucl": sm(src["spc"], "ucl"), "lcl": sm(src["spc"], "lcl")},
        "attendance": {"total": sm(src["attendance"], "scheduled"), "present": sm(src["attendance"], "present")},
        "safety": _safety_of(src["safety"], in_range),
    }


def compute_report(r: dict[str, Any]) -> dict[str, Any]:
    f = r["fixed"]
    unit_price, recycle_value, recycle_rate = f["unitPrice"], f["recycleValue"], f["recycleRate"]

    def mul(n: float | None, v: float | None) -> float | None:
        return None if n is None or v is None else n * v

    recycled = None if recycle_rate is None else round(r["defects"] * recycle_rate)
    amount = mul(r["production"], unit_price)
    loss_cost = mul(r["defects"], unit_price)
    recycle_saving = mul(recycled, recycle_value)
    net_loss = None if loss_cost is None or recycle_saving is None else loss_cost - recycle_saving
    companies = sorted(r["safety"]["byCompany"], key=lambda x: -x["count"])
    gears = sorted(
        ((g, n) for g, n in r["safety"]["byGear"].items() if n > 0),
        key=lambda x: -x[1],
    )
    return {
        "attendanceRate": ratio(r["attendance"]["present"], r["attendance"]["total"]),
        "amount": amount,
        "defectRate": ratio(r["defects"], r["production"]),
        "lossCost": loss_cost,
        "spcTotal": r["spcAlarms"]["ucl"] + r["spcAlarms"]["lcl"],
        "recycled": recycled,
        "recycleSaving": recycle_saving,
        "netLoss": net_loss,
        "netLossRate": None if net_loss is None or amount is None else ratio(net_loss, amount),
        "perCapita": ratio(r["production"], r["attendance"]["present"]),
        "safetyPassRate": ratio(r["safety"]["scans"] - r["safety"]["violations"], r["safety"]["scans"]),
        "companies": companies,
        "gears": gears,
    }


def compare_report(r: dict[str, Any], prev: dict[str, Any] | None) -> dict[str, float | None]:
    if not prev:
        return {"violations": None, "defectRatePp": None}
    cur = ratio(r["defects"], r["production"])
    before = ratio(prev["defects"], prev["production"])
    return {
        "violations": r["safety"]["violations"] - prev["safety"]["violations"],
        "defectRatePp": None if cur is None or before is None else (cur - before) * 100,
    }
