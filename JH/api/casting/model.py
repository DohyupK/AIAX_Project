"""1차(ML) 품질 검사 모델 — Model Management 에서 「품질 1차 검사」(DB process_code CAST-OPT)로 배포된 모델 사용

배포 모델 = ai.model_registry 의 CAST-OPT·deployed 행 → file_name 으로 TM/model/<이름>/<파일> 을 불러옴.
배포 모델이 없으면 기본 모델(TM 배포 DieCasting_XGB_20261114_09)을 씀 — 레지스트리 등록 전까지 (사용자 결정 1a).
pkl 형식: TM 최종 모델 형식(dict: model·features·threshold·thresholds). 명세: TM/기능표.md
보안: pickle 은 불러올 때 코드가 실행되므로 TM/model 폴더 안 .pkl 만 허용 (DB 값이라도 다른 경로·형식 거절).
"""
from __future__ import annotations

import logging
import math
import pickle
import re
import threading
from pathlib import Path

import numpy as np

from common.db import connect

log = logging.getLogger("jh.casting.model")

MODEL_DIR = (Path(__file__).resolve().parents[3] / "TM" / "model").resolve()
DEFAULT_NAME = "DieCasting_XGB_20261114_09"            # 레지스트리 등록 전 기본 모델
DEFAULT_FILE = f"{DEFAULT_NAME}.pkl"
PROCESS_CODE = "CAST-OPT"                              # DB 코드 = 화면 「품질 1차 검사」 (코드 이름은 MS 결정 전까지 유지)
FILE_RE = re.compile(r"^[A-Za-z0-9_.-]+\.pkl$")        # 파일 이름만 (경로 구분자 금지)
PRESSURE_LOW = 600                                     # pressure_low = injection_pressure < 600 (TM 전처리 규칙)

_lock = threading.Lock()
_current: dict = {}   # 메모리에는 지금 쓰는 모델 1개만 — {"key": (name, version, file), "obj": ..., "meta": ...}


class ModelError(RuntimeError):
    """배포 모델 파일이 없거나 형식이 맞지 않음 — 화면에 그대로 안내"""


def _deployed() -> dict | None:
    """DB 에서 품질 1차 검사 배포 모델 (없으면 None)"""
    with connect("DATABASE_URL") as conn:
        return conn.execute(
            "SELECT model_name, version, file_name FROM ai.model_registry WHERE process_code = %s AND deployed",
            (PROCESS_CODE,),
        ).fetchone()


def _path(file_name: str | None) -> Path:
    if not file_name or not FILE_RE.match(file_name):
        raise ModelError(f"배포 모델 파일 이름이 올바르지 않습니다: {file_name!r} (.pkl 파일 이름만 허용)")
    p = (MODEL_DIR / Path(file_name).stem / file_name).resolve()
    if not p.is_relative_to(MODEL_DIR) or not p.is_file():
        raise ModelError(f"배포 모델 파일을 찾을 수 없습니다: TM/model/{Path(file_name).stem}/{file_name}")
    return p


def _load(path: Path) -> dict:
    with path.open("rb") as f:
        obj = pickle.load(f)
    if not isinstance(obj, dict) or {"model", "features", "threshold"} - obj.keys():
        raise ModelError(f"모델 형식이 다릅니다 ({path.name}): TM 최종 모델 형식(model·features·threshold) pkl 만 사용 가능")
    feats = list(obj["features"])
    if len(feats) != 8 or feats[0] != "pressure_low":
        raise ModelError(f"모델 입력 형식이 다릅니다 ({path.name}): {feats}")
    return obj


def current() -> tuple[dict, dict]:
    """(pkl 객체, 표시용 정보) — 배포 모델이 바뀌면 새로 불러오고 이전 모델은 메모리에서 버림"""
    row = _deployed()
    if row:
        key = (row["model_name"], row["version"], row["file_name"])
        meta = {"name": row["model_name"], "version": row["version"], "source": "registry"}
    else:
        key = (DEFAULT_NAME, "", DEFAULT_FILE)
        meta = {"name": DEFAULT_NAME, "version": "", "source": "default"}
    with _lock:
        if _current.get("key") != key:
            obj = _load(_path(key[2]))
            _current.clear()
            _current.update(key=key, obj=obj, meta=meta)
            log.info("1차 검사 모델 로드 %s %s (%s) threshold=%.3f", key[0], key[1], meta["source"], obj["threshold"])
        return _current["obj"], _current["meta"]


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
    m, _ = current()
    x = np.array([_row(r, m["features"]) for r in rows], dtype=float)
    return [float(v) for v in m["model"].predict_proba(x)[:, 1]]


def info() -> dict:
    """화면 표시용 — 쓰는 모델(배포 / 기본)·기준값·TM 검증 성적(pkl 에 있으면)"""
    m, meta = current()
    thresholds = m.get("thresholds") or {}
    test = next(iter(thresholds.values()), {}).get("Test_검증모델", {}) if thresholds else {}
    return {
        **meta,
        "threshold": float(m["threshold"]),
        "trainedOn": m.get("trained_on", ""),
        "features": list(m["features"]),
        "test": {k: float(v) for k, v in test.items() if k in ("Recall", "Precision", "F1")},
    }
