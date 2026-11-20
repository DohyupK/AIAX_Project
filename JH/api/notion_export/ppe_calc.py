"""보호구 월간 보고서 계산 — 프론트 monthly.ts 와 동일"""
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
SITE = "회사 정문 보호구 게이트 a·b · 대상: 주조팀(casting1~3)·하청 작업자"


def violation_rate(violations: int, scans: int) -> float | None:
    return round((violations / scans) * 10000) / 10 if scans else None


def _md(d: str) -> str:
    return f"{int(d[5:7])}. {int(d[8:10])}."


def totals(raw: dict[str, Any]) -> dict[str, Any]:
    scans = sum(u["scans"] for u in raw["units"])
    violations = sum(u["violations"] for u in raw["units"])
    return {"scans": scans, "violations": violations, "rate": violation_rate(violations, scans)}


def build_ppe_report(month: str, all_raw: list[dict[str, Any]]) -> dict[str, Any]:
    raw = next((r for r in all_raw if r["month"] == month), None)
    if not raw:
        raise ValueError(f"보고서 원자료 없음: {month}")
    y, m = map(int, month.split("-"))
    prev_month = f"{y - 1}-12" if m == 1 else f"{y}-{m - 1:02d}"
    prev = next((r for r in all_raw if r["month"] == prev_month), None)

    cur = totals(raw)
    prev_total = totals(prev) if prev else None
    delta = None
    if cur["rate"] is not None and prev_total and prev_total["rate"] is not None:
        delta = round((cur["rate"] - prev_total["rate"]) * 10) / 10

    start = min((r["from"] for r in all_raw), default=raw["from"])
    y0, m0, d0 = map(int, start.split("-"))
    history = [totals(r)["rate"] or 0 for r in all_raw if r["month"] <= month]
    if len(history) < 2:
        rank = "가동 첫 달"
    elif cur["rate"] == min(history):
        rank = f"{m0}월 가동 이후 최저"
    elif cur["rate"] == max(history):
        rank = f"{m0}월 가동 이후 최고"
    else:
        rank = ""

    units = []
    for u in raw["units"]:
        p = None
        if prev:
            p = next((x for x in prev["units"] if x["name"] == u["name"] and x["gate"] == u["gate"]), None)
        units.append(
            {
                **u,
                "rate": violation_rate(u["violations"], u["scans"]),
                "prevRate": violation_rate(p["violations"], p["scans"]) if p else None,
            }
        )
    units.sort(key=lambda u: -(u["rate"] or 0))

    gears = [
        {"gear": g, **raw["gears"][g], "total": raw["gears"][g]["hq"] + raw["gears"][g]["sub"]}
        for g in GEARS
        if g in raw["gears"]
    ]
    gears.sort(key=lambda g: -g["total"])

    slots = sorted(raw["slots"], key=lambda x: (-x["violations"], x["hour"]))
    slots = [
        {**x, "pct": round((x["violations"] / cur["violations"]) * 100) if cur["violations"] else 0}
        for x in slots
    ]

    return {
        "month": month,
        "monthNo": m,
        "prevMonthNo": 12 if m == 1 else m - 1,
        "title": f"{y}년 {m}월",
        "period": f"{_md(raw['from'])} ~ {_md(raw['to'])}",
        "workDays": raw["days"],
        "registered": raw["registered"],
        "entered": raw["entered"],
        **cur,
        "prevRate": prev_total["rate"] if prev_total else None,
        "delta": delta,
        "rank": rank,
        "units": units,
        "gates": "·".join(sorted({u["gate"] for u in raw["units"]})),
        "gears": gears,
        "slots": slots,
        "start": f"{y0}. {m0}. {d0}.",
        "site": SITE,
    }
