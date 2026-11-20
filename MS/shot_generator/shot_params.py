"""샷 생성기 값 목록 만들기 — 원본(line_no1 2026-08-04~10-11)에서 TM 규칙 문서대로 추출 (2026-11-20, MS)

근거: MS/db/docs/시연 데이터 생성 규칙 (실시간용).pdf · (EDA 근거).pdf
  - 런 = 원본 파일 순서에서 생산번호가 1로 돌아가는 단위 (64개). 원본 timestamp 는 실제 날짜가 아니라 런 라벨
  - 조건 구간 = 런 25~34, 샷 유형 = 경보 아닌 샷의 상형1·2·하형1·2·슬리브를 표준화해 KMeans(3) → 하형1 가장 높은 군집 = 고온형
  - 정상 샷 값 분포 = 고온형 정상 샷(센서 오류값·용탕량 빈 값 제외) 5,989샷
  - 런 길이 62개(0.5·2.3시간 짜리 2개 제외), 런 사이 정지 63개, 경보 샷 원본 행(압력 미달 176 + 기타 5)
  - 상관 행렬·불량 계수·확률은 문서 값을 그대로 씀
실행 (이 폴더에서, MS PC — pandas·scikit-learn 필요): python shot_params.py [원본 CSV 경로]
이미 만든 shot_params.json 이 있으면 다시 돌릴 필요 없음 (원본이 바뀔 때만)
결과: 이 폴더의 shot_params.json (생성기가 읽음)
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd

OUT = Path(__file__).with_name("shot_params.json")
DEFAULT_CSV = r"D:\AIAX_data\casting_process\line_no1_full.csv"
ORIGINAL_UNTIL = "2026-10-12"   # 이 날짜 전 line_no1 = 원본
# 규칙 3 변수 12개 (문서 상관 행렬 순서)
VARS = ["top_temp1", "top_temp2", "bottom_temp1", "bottom_temp2", "biscuit_thickness", "cooling_water_temp",
        "injection_pressure", "mechanical_strength", "sleeve_temperature", "mold_temperature",
        "molten_capacity", "production_cycletime"]
CORR = [  # 문서 「상관 행렬 (정규 점수 상관)」
    [1, .86, .80, .70, .10, .40, -.12, -.22, .52, .09, -.13, -.02],
    [.86, 1, .80, .80, .13, .46, -.12, -.25, .48, .09, -.14, -.01],
    [.80, .80, 1, .74, .16, .31, -.14, -.21, .60, .17, -.24, -.08],
    [.70, .80, .74, 1, .22, .53, -.06, -.18, .67, .18, -.23, -.11],
    [.10, .13, .16, .22, 1, -.07, .06, .12, .01, .41, -.60, -.02],
    [.40, .46, .31, .53, -.07, 1, -.02, -.12, .45, .01, .01, .02],
    [-.12, -.12, -.14, -.06, .06, -.02, 1, .13, -.04, .01, -.03, 0],
    [-.22, -.25, -.21, -.18, .12, -.12, .13, 1, -.07, .11, -.11, 0],
    [.52, .48, .60, .67, .01, .45, -.04, -.07, 1, .14, -.13, -.09],
    [.09, .09, .17, .18, .41, .01, .01, .11, .14, 1, -.69, 0],
    [-.13, -.14, -.24, -.23, -.60, .01, -.03, -.11, -.13, -.69, 1, 0],
    [-.02, -.01, -.08, -.11, -.02, .02, 0, 0, -.09, 0, 0, 1],
]
RULES = {  # 문서 규칙 1·2·4·5·6 의 수치
    "p_under_after_under": 0.5114, "p_under": 0.01428, "max_under_run": 8, "p_other_alarm": 0.00083,
    "p_alarm_defect": 0.9945,
    "logit_base": -2.6308, "logit_offset": -0.1840, "logit_prev_fail": 4.4938,
    "bins": {  # 변수: [경계들, 1번~ 구간 계수]
        "top_temp1": [[362, 373, 379, 387], [-0.387, -0.803, -0.668, -1.553]],
        "top_temp2": [[367, 373, 375, 379], [-0.842, -1.162, -0.575, -1.091]],
        "bottom_temp1": [[548, 563, 569, 578], [-1.546, -1.233, -0.633, 0.316]],
        "bottom_temp2": [[357, 363, 367, 369], [-0.461, 0.032, -1.164, -0.399]],
        "biscuit_thickness": [[146, 149, 151, 153], [-0.266, -0.075, -0.297, -0.048]],
        "cooling_water_temp": [[31, 33, 35], [0.085, -0.140, 0.900]],
        "sleeve_temperature": [[372, 377, 381, 383], [-1.873, -1.470, -1.397, -1.565]],
        "mold_temperature": [[582, 591, 594, 595], [0.073, 0.309, 1.021, 0.706]],
    },
    "facility_diff": {"values": list(range(1, 10)), "probs": [1 / 9] * 9},
    "top3_diff": {"values": [1, 2, 3, 4, 0, 5, 6, 7, 8, 9, 10, 11],
                  "probs": [.702, .206, .056, .019, .007] + [.010 / 7] * 7},
    "top_temp4": 1620, "bottom_temp4": 1880,
    "sensor_error": [[0.00113, 0], [0.00065, 653]],   # [확률, 용탕량 값]
}


def kmeans(Z: np.ndarray, k: int = 3, inits: int = 20, seed: int = 0) -> np.ndarray:
    """KMeans (Lloyd, 여러 번 시작해 오차가 가장 작은 결과). 중심 반환"""
    rng = np.random.default_rng(seed)
    best = None
    for _ in range(inits):
        C = Z[rng.choice(len(Z), k, replace=False)]
        for _ in range(300):
            lab = ((Z[:, None] - C[None]) ** 2).sum(2).argmin(1)
            C2 = np.array([Z[lab == j].mean(0) for j in range(k)])
            if np.allclose(C, C2):
                break
            C = C2
        inertia = ((Z - C[lab]) ** 2).sum()
        if best is None or inertia < best[0]:
            best = (inertia, C)
    return best[1]


def build(csv_path: str) -> dict:
    d = pd.read_csv(csv_path, encoding="utf-8-sig", dtype=str)
    d.columns = [c.strip().lower() for c in d.columns]
    o = d[(d.line_unit == "line_no1") & (d.timestamp < ORIGINAL_UNTIL)].reset_index(drop=True)  # 파일 순서 유지
    for c in o.columns:
        if c not in ("line_unit", "production", "timestamp", "date"):
            o[c] = pd.to_numeric(o[c], errors="coerce")
    o["run"] = (o.production_count == 1).cumsum()
    sec = pd.to_timedelta(o.date).dt.total_seconds().values

    # 규칙 1: 런 길이(시간, 자정 넘김 보정) · 런 사이 정지(초)
    hours, stops = [], []
    for r in range(1, o.run.max() + 1):
        idx = o.index[o.run == r]
        dd = np.diff(sec[idx]); dd[dd < 0] += 86400
        hours.append(dd.sum() / 3600)
        if r < o.run.max():
            stops.append(int((sec[o.index[o.run == r + 1][0]] - sec[idx[-1]]) % 86400))
    hours = [round(h, 3) for h in hours if h >= 6.0]   # 0.5·2.3시간 런 2개 제외 → 62개

    # 조건 구간 런 25~34 → 경보 / 고온형
    seg = o[(o.run >= 25) & (o.run <= 34)].copy()
    under = seg.injection_pressure < 600
    other = (~under) & ((seg.biscuit_thickness <= 125) | (seg.mechanical_strength == 0))
    f = ["top_temp1", "top_temp2", "bottom_temp1", "bottom_temp2", "sleeve_temperature"]
    X = seg.loc[~(under | other), f]
    mu, sd = X.mean(), X.std(ddof=0)
    C = kmeans(((X - mu) / sd).values)
    hot = int(np.argmax((C * sd.values + mu.values)[:, 2]))           # 하형1 가장 높은 군집
    Za = ((seg[f] - mu) / sd).fillna(0).values                         # 경보 샷도 가장 가까운 군집으로
    seg["hot"] = ((Za[:, None] - C[None]) ** 2).sum(2).argmin(1) == hot
    h = seg[seg.hot]
    hu = h.injection_pressure < 600
    ho = (~hu) & ((h.biscuit_thickness <= 125) | (h.mechanical_strength == 0))
    n = h[~(hu | ho)]
    err = n.molten_capacity.isna() | (n.molten_capacity <= 0) | (n.molten_capacity > 100) | (n.mold_temperature == 0)
    n = n[~err]

    def rows(df):
        return [[None if pd.isna(v) else int(v) for v in r] for r in df[VARS].itertuples(index=False)]

    dists = {}
    for v in VARS:
        vc = n[v].astype(int).value_counts().sort_index()
        dists[v] = {"values": vc.index.tolist(), "counts": vc.values.tolist()}

    return {
        "source": {"csv": Path(csv_path).name, "original_until": ORIGINAL_UNTIL, "runs": int(o.run.max()),
                   "segment_runs": [25, 34], "segment_shots": len(seg), "hot_shots": len(h),
                   "normal_shots": len(n), "under_rows": int(hu.sum()), "other_rows": int(ho.sum())},
        "vars": VARS, "corr": CORR, "dists": dists,
        "run_hours": hours, "stop_seconds": stops,
        "alarm_under": rows(h[hu]), "alarm_other": rows(h[ho]),
        "rules": RULES,
    }


def main() -> None:
    p = build(sys.argv[1] if len(sys.argv) > 1 else DEFAULT_CSV)
    OUT.write_text(json.dumps(p, ensure_ascii=False), encoding="utf-8")
    s = p["source"]
    print(f"[shot_params] 저장: {OUT}")
    print(f"  원본 런 {s['runs']} · 조건 구간 {s['segment_shots']:,}샷 · 고온형 {s['hot_shots']:,} · 정상 {s['normal_shots']:,}"
          f" · 압력 미달 {s['under_rows']} · 기타 경보 {s['other_rows']} · 런 길이 {len(p['run_hours'])} · 정지 {len(p['stop_seconds'])}")


if __name__ == "__main__":
    main()
