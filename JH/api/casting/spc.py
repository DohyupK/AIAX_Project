"""관리도(SPC) 계산 — 생산 흐름·생산 런 기준 (공정 최적화 관리도, router.py /api/casting/spc)

- 기준선 = 라인별·변수별 고정 표 (JH 제공, 2026-11-19, 날짜 무관)
  공식: I = CL ± 3σ, MR UCL = 3.267 × MR̄ (LCL 0), EWMA = CL ± 3σ·√(λ/(2-λ)) = CL ± 1σ (λ 0.2) — 자체 점검: spc_check.py
- 생산 흐름: 시각 순 샷을 「생산번호가 +1 로 이어지는 흐름」으로 나눔. 라인1 원본 구간(10-11 이전)은 금형이 여러 개
  번갈아 돌아 생산번호 줄이 최대 4개 섞여 있음 → 흐름마다 따로 계산해 화면에서 겹쳐 그림. 그 밖은 흐름 1개
- 생산 런: 흐름 안에서 생산번호가 직전보다 작아지는 샷(재가동) = 새 런의 첫 샷.
  EWMA·MR·넬슨 2·3 은 런의 첫 샷부터 계산하고, 화면에 보이는 구간만 잘라서 돌려줌
  (날짜·창·라인 선택은 보여 주는 범위만 바꾸고 계산 시작점은 바꾸지 않음)
"""
from __future__ import annotations

LAMBDA = 0.2      # EWMA 가중치
LOOKAHEAD = 20    # 재가동 판정: 앞으로 이만큼 안에 다음 번호가 나오는 흐름은 계속 도는 중

# 표 한 줄 = (CL, σ, I LCL, I UCL, MR CL, MR UCL, EWMA LCL, EWMA UCL). 키 = 화면 변수 이름 (router.FEATURES)
# 상·하형 온도3 은 표에 없어 관리도 대상 아님
_TABLE: dict[str, dict[str, tuple[float, ...]]] = {
    "line_no1": {
        "top_temp1": (374.95, 26.16, 296.49, 453.42, 29.50, 96.39, 348.80, 401.11),
        "top_temp2": (371.56, 9.72, 342.39, 400.74, 10.97, 35.84, 361.84, 381.29),
        "bottom_temp1": (558.47, 25.08, 483.23, 633.71, 28.29, 92.43, 533.39, 583.55),
        "bottom_temp2": (361.85, 11.17, 328.35, 395.35, 12.60, 41.15, 350.68, 373.01),
        "biscuit_thickness": (149.43, 3.45, 139.09, 159.77, 3.89, 12.70, 145.98, 152.87),
        "cooling_water_temp": (32.81, 2.26, 26.03, 39.59, 2.55, 8.33, 30.55, 35.07),
        "injection_pressure": (657.84, 1.19, 654.27, 661.40, 1.34, 4.38, 656.65, 659.02),
        "mechanical_strength": (87.17, 0.38, 86.02, 88.32, 0.43, 1.41, 86.78, 87.55),
        "sleeve_temperature": (377.97, 7.00, 356.97, 398.96, 7.89, 25.79, 370.97, 384.96),
        "mold_temperature": (589.83, 6.62, 569.98, 609.69, 7.47, 24.39, 583.22, 596.45),
        "molten_capacity": (14.85, 5.07, -0.35, 30.05, 5.72, 18.67, 9.78, 19.92),
        "facility_CycleTime": (146.76, 7.78, 123.42, 170.10, 8.78, 28.67, 138.98, 154.54),
        "production_CycleTime": (151.76, 7.34, 129.74, 173.77, 8.28, 27.04, 144.42, 159.09),
    },
    "line_no2": {
        "top_temp1": (374.03, 25.43, 297.73, 450.34, 28.69, 93.73, 348.60, 399.47),
        "top_temp2": (371.62, 9.36, 343.54, 399.69, 10.56, 34.49, 362.26, 380.97),
        "bottom_temp1": (558.68, 24.88, 484.03, 633.32, 28.07, 91.69, 533.79, 583.56),
        "bottom_temp2": (361.84, 10.97, 328.91, 394.76, 12.38, 40.44, 350.86, 372.81),
        "biscuit_thickness": (149.45, 3.40, 139.26, 159.63, 3.83, 12.51, 146.05, 152.84),
        "cooling_water_temp": (32.81, 2.24, 26.11, 39.52, 2.52, 8.24, 30.58, 35.05),
        "injection_pressure": (657.84, 1.19, 654.27, 661.40, 1.34, 4.38, 656.65, 659.02),
        "mechanical_strength": (87.19, 0.40, 86.00, 88.38, 0.45, 1.46, 86.79, 87.59),
        "sleeve_temperature": (377.96, 6.65, 358.00, 397.92, 7.51, 24.52, 371.31, 384.62),
        "mold_temperature": (589.78, 6.48, 570.34, 609.23, 7.31, 23.89, 583.30, 596.27),
        "molten_capacity": (14.88, 5.10, -0.41, 30.16, 5.75, 18.78, 9.78, 19.97),
        "facility_CycleTime": (146.84, 8.04, 122.70, 170.97, 9.07, 29.64, 138.79, 154.88),
        "production_CycleTime": (151.94, 7.61, 129.11, 174.78, 8.59, 28.05, 144.33, 159.56),
    },
    "line_no3": {
        "top_temp1": (373.88, 25.75, 296.64, 451.13, 29.05, 94.89, 348.14, 399.63),
        "top_temp2": (371.35, 9.56, 342.67, 400.03, 10.78, 35.23, 361.79, 380.91),
        "bottom_temp1": (558.55, 25.02, 483.49, 633.62, 28.22, 92.21, 533.53, 583.57),
        "bottom_temp2": (361.75, 10.96, 328.88, 394.62, 12.36, 40.38, 350.80, 372.71),
        "biscuit_thickness": (149.47, 3.47, 139.05, 159.88, 3.92, 12.79, 145.99, 152.94),
        "cooling_water_temp": (32.78, 2.26, 26.00, 39.56, 2.55, 8.33, 30.52, 35.04),
        "injection_pressure": (657.88, 1.23, 654.19, 661.58, 1.39, 4.54, 656.65, 659.11),
        "mechanical_strength": (87.19, 0.40, 86.01, 88.39, 0.45, 1.46, 86.80, 87.59),
        "sleeve_temperature": (377.19, 8.32, 352.24, 402.15, 9.38, 30.65, 368.88, 385.51),
        "mold_temperature": (589.59, 6.98, 568.65, 610.52, 7.87, 25.72, 582.61, 596.57),
        "molten_capacity": (14.85, 5.21, -0.77, 30.47, 5.87, 19.19, 9.64, 20.06),
        "facility_CycleTime": (146.78, 8.07, 122.56, 171.00, 9.11, 29.75, 138.71, 154.85),
        "production_CycleTime": (151.81, 7.57, 129.11, 174.50, 8.53, 27.88, 144.24, 159.37),
    },
}
_FIELDS = ("cl", "sigma", "iLcl", "iUcl", "mrCl", "mrUcl", "ewmaLcl", "ewmaUcl")

# (기준 기간 시작, 끝, 판정 시작). 기준 기간 = 표를 계산한 첫 7일 (정상 조건 양품 샷)
# 알림은 판정 시작일(기준 기간 다음 날)부터 — 기준 기간·그 앞(라인1 원본 08-04~10-11)은 판정 안 함 (사용자 결정 2026-11-20)
# 출처: 공정 최적화 알림 개발 명세 (2026-11-18) 2장
PERIODS: dict[str, tuple[str, str, str]] = {
    "line_no1": ("2026-10-12", "2026-10-18", "2026-10-19"),
    "line_no2": ("2026-11-01", "2026-11-07", "2026-11-08"),
    "line_no3": ("2026-11-01", "2026-11-07", "2026-11-08"),
}


def baseline(line: str, key: str) -> dict | None:
    """라인·변수의 기준선 (없으면 None)"""
    row = _TABLE.get(line, {}).get(key)
    return dict(zip(_FIELDS, row)) if row else None


def limits(line: str) -> dict | None:
    """알림 판정용 — 라인의 13개 변수 관리선 + 기준 기간 (없는 라인이면 None)"""
    if line not in _TABLE or line not in PERIODS:
        return None
    start, end, judge = PERIODS[line]
    return {"line": line, "baselineFrom": start, "baselineTo": end, "judgeFrom": judge, "lambda": LAMBDA,
            "variables": {k: baseline(line, k) for k in _TABLE[line]}}


def split_flows(counts: list[int]) -> list[int]:
    """시각 순 생산번호 → 샷마다 흐름 번호(0, 1, …).
    +1 로 이어지는 흐름에 붙이고, 없으면 번호가 가장 가까운(작은) 흐름. 모든 흐름보다 작으면 재가동:
    앞으로 LOOKAHEAD 샷 안에 다음 번호가 안 나오는(멈춘) 흐름이 다시 시작한 것으로 보고, 모두 돌고 있으면 새 흐름"""
    last: list[int] = []
    seen: list[int] = []
    out: list[int] = []
    for i, p in enumerate(counts):
        exact = [j for j, s in enumerate(last) if s == p - 1]
        lower = [j for j, s in enumerate(last) if s < p]
        if exact:
            j = exact[0]
        elif lower:
            j = max(lower, key=lambda j: last[j])
        else:
            ahead = set(counts[i + 1:i + 1 + LOOKAHEAD])
            stopped = [j for j, s in enumerate(last) if s + 1 not in ahead]
            if stopped:
                j = min(stopped, key=lambda j: seen[j])
            else:
                last.append(0)
                seen.append(i)
                j = len(last) - 1
        last[j], seen[j] = p, i
        out.append(j)
    return out


def nelson_23(v: list[float], cl: float) -> list[set[int]]:
    """넬슨 규칙 2(중심선 한쪽 9점 연속)·3(6점 연속 증가/감소) — 연속 구간의 모든 점에 표시. 같은 값·중심선 위 점은 흐름 끊김"""
    flags: list[set[int]] = [set() for _ in v]

    def mark(a: int, b: int, n: int, rule: int) -> None:
        if b - a + 1 >= n:
            for j in range(a, b + 1):
                flags[j].add(rule)

    side = [(x > cl) - (x < cl) for x in v]
    s = 0
    for i in range(len(v) + 1):
        if i == len(v) or side[i] == 0 or side[i] != side[s]:
            if s < len(v) and side[s] != 0:
                mark(s, i - 1, 9, 2)
            s = i
    d = [0] + [(v[i] > v[i - 1]) - (v[i] < v[i - 1]) for i in range(1, len(v))]
    s = 0
    for i in range(1, len(v) + 1):
        if i == len(v) or d[i] == 0 or (i > s + 1 and d[i] != d[i - 1]):
            mark(s, i - 1, 6, 3)
            s = i if i < len(v) and d[i] == 0 else i - 1
    return flags


def compute(rows: list[dict], first: int, base: dict) -> list[dict]:
    """rows = 시각 순 샷(앞쪽 문맥 + 보이는 구간, 값 칼럼 v), first = 보이는 구간 시작 위치.
    흐름별 → 런별로 EWMA·MR·넬슨 2·3 계산 후 보이는 구간의 값이 있는 샷만 돌려줌 (빈 값은 판정 제외).
    flow = 보이는 구간에서 처음 나온 순서(0 = A) — 조회 범위가 달라도 같은 흐름이 같은 색"""
    flows = split_flows([r["production_count"] for r in rows])
    out: dict[int, dict] = {}
    for f in sorted(set(flows)):
        idx = [i for i, x in enumerate(flows) if x == f]
        # 보이는 구간이 걸린 흐름만 — 그 흐름 안에서 생산번호가 줄어드는 곳 = 새 런
        if idx[-1] < first:
            continue
        starts = [0] + [n for n in range(1, len(idx)) if rows[idx[n]]["production_count"] <= rows[idx[n - 1]]["production_count"]]
        for a, b in zip(starts, starts[1:] + [len(idx)]):
            run = idx[a:b]
            if run[-1] < first:
                continue
            # 조회한 앞쪽 문맥의 첫 샷이 생산번호 1 이 아니면 런 시작이 더 앞일 수 있음 (조회 한도) → approx 표시
            approx = a == 0 and rows[idx[0]]["production_count"] > 1
            pts = [(i, rows[i]["v"]) for i in run if rows[i]["v"] is not None]
            vals = [float(v) for _, v in pts]
            n23 = nelson_23(vals, base["cl"])
            z = base["cl"]
            for n, (i, v) in enumerate(pts):
                z = LAMBDA * vals[n] + (1 - LAMBDA) * z
                mr = abs(vals[n] - vals[n - 1]) if n else None
                if i < first:
                    continue
                marks = []
                if vals[n] > base["iUcl"] or vals[n] < base["iLcl"]:
                    marks.append("n1")
                marks += [f"n{r}" for r in sorted(n23[n])]
                if mr is not None and mr > base["mrUcl"]:
                    marks.append("mr")
                if z > base["ewmaUcl"] or z < base["ewmaLcl"]:
                    marks.append("ewma")
                r = rows[i]
                t = r["date"]
                out[i] = {
                    "castingId": r["casting_id"], "shotId": r["production_count"],
                    "time": f"{t.hour}:{t.minute:02d}:{t.second:02d}",
                    "flow": f, "runStart": n == 0, "approx": approx,
                    "value": vals[n], "mr": mr, "ewma": z, "marks": marks,
                }
    shown = [out[i] for i in sorted(out)]
    order: dict[int, int] = {}
    for x in shown:
        x["flow"] = order.setdefault(x["flow"], len(order))
    return shown

