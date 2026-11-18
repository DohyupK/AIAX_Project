"""공정(주조) 데이터 API — mes.investment_casting 원본을 읽기 전용 계정(app_lake)으로 조회

응답 형식은 프런트 JH/frontend/common/casting/types.ts 의 Shot 과 같음.
prob = 1차(ML) 불량 점수 (TM 배포 모델 DieCasting_XGB_20261114_09, casting/model.py), actual = 실제 판정(passorfail).
"""
from __future__ import annotations

import logging
from datetime import date as Date

from fastapi import APIRouter, HTTPException, Query

from casting import model
from common.db import connect

router = APIRouter(prefix="/api/casting")
log = logging.getLogger("jh.casting")
DB = "DATABASE_URL"   # app_lake — mes 읽기만

# 프런트 FEATURES 이름 ← DB 칼럼 (DB는 소문자)
FEATURES = {
    "injection_pressure": "injection_pressure", "sleeve_temperature": "sleeve_temperature",
    "top_temp1": "top_temp1", "top_temp2": "top_temp2", "top_temp3": "top_temp3",
    "bottom_temp1": "bottom_temp1", "bottom_temp2": "bottom_temp2", "bottom_temp3": "bottom_temp3",
    "cooling_water_temp": "cooling_water_temp", "biscuit_thickness": "biscuit_thickness",
    "mechanical_strength": "mechanical_strength", "mold_temperature": "mold_temperature",
    "molten_capacity": "molten_capacity",
    "facility_CycleTime": "facility_cycletime", "production_CycleTime": "production_cycletime",
}
LINE = Query(pattern=r"^line_no\d{1,2}$")


def to_shot(r: dict, score: float) -> dict:
    t = r["date"]
    return {
        "shotId": r["production_count"],
        "time": f"{t.hour}:{t.minute:02d}:{t.second:02d}",
        "prob": score,   # 1차(ML) 불량 점수 0~1 — casting/model.py
        "actual": r["passorfail"],
        "features": {k: r[col] for k, col in FEATURES.items()},
        "castingId": r["casting_id"],
    }


@router.get("/dates")
def dates(line: str = LINE) -> list[str]:
    """데이터가 있는 날짜 (최근 날짜가 먼저)"""
    try:
        with connect(DB) as conn:
            rows = conn.execute(
                'SELECT DISTINCT "timestamp" AS d FROM mes.investment_casting WHERE line_unit = %s ORDER BY 1 DESC',
                (line,),
            ).fetchall()
    except Exception:
        log.exception("공정 날짜 조회 실패 line=%s", line)
        raise HTTPException(503, "공정 DB 조회에 실패했습니다.")
    return [r["d"].isoformat() for r in rows]


@router.get("/predictions")
def predictions(date: Date, line: str = LINE) -> list[dict]:
    """그날 샷 전체 (시간순)"""
    cols = ", ".join(sorted({"casting_id", "date", "production_count", "passorfail", *FEATURES.values()}))
    try:
        with connect(DB) as conn:
            rows = conn.execute(
                f'SELECT {cols} FROM mes.investment_casting WHERE line_unit = %s AND "timestamp" = %s '
                "ORDER BY date, production_count",
                (line, date),
            ).fetchall()
    except Exception:
        log.exception("공정 샷 조회 실패 line=%s date=%s", line, date)
        raise HTTPException(503, "공정 DB 조회에 실패했습니다.")
    try:
        sc = model.scores(rows)
    except Exception:
        log.exception("1차 검사 모델 점수 계산 실패 line=%s date=%s", line, date)
        raise HTTPException(503, "1차 검사 모델을 실행하지 못했습니다.")
    return [to_shot(r, s) for r, s in zip(rows, sc)]


@router.get("/model")
def model_info() -> dict:
    """1차(ML) 검사 모델 정보 — 이름·기준값·검증 성적"""
    try:
        return model.info()
    except Exception:
        log.exception("1차 검사 모델 로드 실패")
        raise HTTPException(503, "1차 검사 모델을 불러오지 못했습니다.")
