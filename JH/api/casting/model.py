"""1차(ML) 품질 검사 모델 — TM 의 배포 모델 pkl 을 불러 샷마다 불량 점수 계산

모델: TM/model/DieCasting_XGB_20261114_09 (배포용, 전체 73,611샷 학습). 명세: TM/기능표.md
입력 8개 순서는 pkl 의 features 그대로, 기준값도 pkl 의 threshold(검증값 0.572) 사용.
보안: pickle 은 불러올 때 코드가 실행되므로 리포 안의 고정 경로 파일만 읽는다 (외부 입력 경로 금지).
ponytail: 경로 고정. Model Management(ai.model_registry) 배포 모델로 바꿀 때 MODEL_PATH 만 DB 조회로 교체.
"""
from __future__ import annotations

import logging
import math
import pickle
import threading
from functools import cache
from pathlib import Path

import numpy as np

log = logging.getLogger("jh.casting.model")

MODEL_NAME = "DieCasting_XGB_20261114_09"
MODEL_PATH = Path(__file__).resolve().parents[3] / "TM" / "model" / MODEL_NAME / f"{MODEL_NAME}.pkl"
PRESSURE_LOW = 600   # pressure_low = injection_pressure < 600 (TM 전처리 규칙)

_lock = threading.Lock()


@cache
def load() -> dict:
    """처음 한 번만 불러 메모리에 둠 (요청마다 디스크·역직렬화 반복 안 함)"""
    with _lock:
        with MODEL_PATH.open("rb") as f:
            obj = pickle.load(f)
    if list(obj["features"])[0] != "pressure_low" or len(obj["features"]) != 8:
        raise RuntimeError(f"모델 입력 형식이 예상과 다릅니다: {obj['features']}")
    log.info("1차 검사 모델 로드 %s threshold=%.3f", MODEL_NAME, obj["threshold"])
    return obj


def _row(r: dict, features: list[str]) -> list[float]:
    p = r.get("injection_pressure")
    # pandas (x < 600).astype(int) 와 같게: 결측이면 0 — 나머지 7개 결측은 NaN 으로 두면 XGBoost 가 처리
    out = [1.0 if p is not None and p < PRESSURE_LOW else 0.0]
    out += [math.nan if r.get(k) is None else float(r[k]) for k in features[1:]]
    return out


def scores(rows: list[dict]) -> list[float]:
    """DB 행(공정 변수 칼럼) 목록 → 불량 점수 0~1 (scale_pos_weight=3 이라 실제 확률보다 높게 나옴)"""
    if not rows:
        return []
    m = load()
    x = np.array([_row(r, m["features"]) for r in rows], dtype=float)
    return [float(v) for v in m["model"].predict_proba(x)[:, 1]]


def info() -> dict:
    """화면 표시용 모델 정보 — 이름·기준값·검증 성적 (pkl 메타데이터)"""
    m = load()
    test = next(iter(m["thresholds"].values())).get("Test_검증모델", {})
    return {
        "name": MODEL_NAME,
        "threshold": float(m["threshold"]),
        "trainedOn": m["trained_on"],
        "features": list(m["features"]),
        "test": {k: float(v) for k, v in test.items() if k in ("Recall", "Precision", "F1")},
    }
