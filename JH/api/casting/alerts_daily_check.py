"""alerts_daily.build_alert_cards 자체 점검 — 프런트 alerts.check.ts 와 같은 사례.

실행: cd JH/api && uv run python -m casting.alerts_daily_check
"""
from __future__ import annotations

from casting.alerts_daily import LABELS, build_alert_cards


def L(cl: float, sigma: float, mr_ucl: float) -> dict:
    return {
        "cl": cl, "sigma": sigma,
        "iLcl": cl - 3 * sigma, "iUcl": cl + 3 * sigma,
        "mrCl": mr_ucl / 3.267, "mrUcl": mr_ucl,
        "ewmaLcl": cl - sigma, "ewmaUcl": cl + sigma,
    }


LIMITS = {
    "line": "line_no1", "baselineFrom": "2026-10-12", "baselineTo": "2026-10-18",
    "judgeFrom": "2026-10-19", "lambda": 0.2,
    "variables": {
        "mold_temperature": L(589.83, 6.62, 24.39),
        "sleeve_temperature": L(377.97, 7.0, 25.79),
        "injection_pressure": L(657.84, 1.19, 4.38),
        "biscuit_thickness": L(149.43, 3.45, 12.7),
        "molten_capacity": L(14.85, 5.07, 18.67),
        "top_temp1": L(374.95, 26.16, 96.39),
        "top_temp2": L(371.56, 9.72, 35.84),
    },
}

_n = 0


def shot(sid: int, f: dict | None = None) -> dict:
    global _n
    alt = 0.1 if _n % 2 else -0.1
    _n += 1
    base = {k: lim["cl"] + alt * lim["sigma"] for k, lim in LIMITS["variables"].items()}
    if f:
        base.update(f)
    return {
        "shotId": sid,
        "time": f"13:{sid % 60:02d}:00",
        "prob": 0, "actual": 0,
        "features": base,
    }


def run(shots: list[dict], date: str = "2026-11-20"):
    return build_alert_cards(shots, LIMITS, date, LABELS)


def main() -> None:
    global _n
    _n = 0
    c = run([
        shot(1058), shot(1059, {"mold_temperature": 567}), shot(1060, {"mold_temperature": 566}),
        shot(1061), shot(1062, {"mold_temperature": 565}),
    ])
    assert [(x.shot_id, x.grade, x.vars[0].rule) for x in c] == [
        (1059, "caution", "n1"), (1060, "watch", "ewma"), (1061, "watch", "mr"), (1062, "caution", "n1"),
    ]
    assert c[1].title == "#1060 용융온도 수준 서서히 하강"
    assert c[0].head == "주의 · 2026-11-20 13:39 · line_no1 · #1059"
    assert c[0].title == "#1059 용융온도 정상 범위 이탈 (낮음)"
    assert c[0].details == ["용융온도 567.0 (관리선 570.0 ~ 609.7)"]
    assert c[0].guide == "용융온도 낮음: 보온로 히터와 잉곳 투입 직후인지 확인하세요."

    _n = 0
    c = run([shot(101), shot(102, {"injection_pressure": 582, "mold_temperature": 500})])
    assert len(c) == 1 and c[0].grade == "alarm"
    assert c[0].title == "#102 주입 압력 설비 한계 이탈 (600 미만)"
    assert c[0].details == ["주입 압력 582 (한계 600)"]
    assert c[0].guide == "주입 압력 한계 미달: 어큐뮬레이터와 유압 장치를 점검하세요."

    _n = 0
    up = lambda i: shot(i, {"sleeve_temperature": 380})
    c = run([*(up(i + 1) for i in range(11)), up(1), *(up(i + 2) for i in range(8))])
    assert [x.shot_id for x in c] == [9, 9]
    assert c[0].title == "#9 슬리브 온도 평균 이동 (높은 쪽, 9샷)"

    _n = 0
    assert len(run([shot(1), shot(2, {"mold_temperature": 0, "molten_capacity": 250})])) == 0
    assert len(run([shot(1), shot(2, {"mold_temperature": 500})], "2026-10-11")) == 0
    assert len(run([shot(1), shot(2, {"mold_temperature": 500})], "2026-10-18")) == 0
    assert len(run([shot(1), shot(2, {"mold_temperature": 500})], "2026-10-19")) == 1

    _n = 0
    d = run([shot(1), shot(2, {"biscuit_thickness": 138, "mold_temperature": 560})])
    assert d[0].title == "#2 용융온도 정상 범위 이탈 (낮음) 외 1건"
    assert len(d[0].details) == 2
    e = run([shot(1), shot(2, {"top_temp1": 290, "top_temp2": 340})])
    assert e[0].extra == "상형 전체 온도 하락: 직전 정지 여부와 상형 온조기를 확인하세요."

    print("alerts_daily_check OK")


if __name__ == "__main__":
    main()
