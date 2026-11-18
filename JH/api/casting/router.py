"""공정(주조) 데이터 API — mes.investment_casting 원본·lake 정제본·ai 라벨을 읽기 전용 계정(app_lake)으로 조회

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
DB = "DATABASE_URL"   # app_lake — mes·lake·ai 읽기만

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
    return [to_shot(r) for r in rows]


# ---- 불량 유형 라벨링 (lake 정제본 + ai 라벨) ----
# ponytail: DL 모델 연결 전이라 「불량 샷」 = 실제 판정 passorfail = 1. 모델이 생기면 모델 판정으로 교체.
# lake 에는 라인 칼럼이 없음 (원본이 전부 line_no1) → 라인 구분 없이 조회
DEFECT_TYPES = ("blowhole", "edge_burr", "surface_rough")   # ai.defect_label 칼럼 = 화면 코드 소문자


@router.get("/defect-dates")
def defect_dates() -> list[str]:
    """불량 샷이 있는 날짜 (최근 날짜가 먼저)"""
    try:
        with connect(DB) as conn:
            rows = conn.execute(
                'SELECT DISTINCT "timestamp" AS d FROM lake.lake_investment_casting WHERE passorfail = 1 ORDER BY 1 DESC'
            ).fetchall()
    except Exception:
        log.exception("불량 날짜 조회 실패")
        raise HTTPException(503, "공정 DB 조회에 실패했습니다.")
    return [r["d"].isoformat() for r in rows]


@router.get("/defects")
def defects(date: Date) -> list[dict]:
    """그날 불량 샷 + 라벨 상태 (최신순). status: unlabeled / labeled / discarded"""
    try:
        with connect(DB) as conn:
            rows = conn.execute(
                """SELECT l.casting_id, l.date AS t, dl.blowhole, dl.edge_burr, dl.surface_rough,
                          dl.labeled_at, dd.discarded_at
                   FROM lake.lake_investment_casting l
                   LEFT JOIN ai.defect_label dl USING (casting_id)
                   LEFT JOIN ai.defect_discard dd USING (casting_id)
                   WHERE l."timestamp" = %s AND l.passorfail = 1
                   ORDER BY l.date DESC, l.casting_id DESC""",
                (date,),
            ).fetchall()
    except Exception:
        log.exception("불량 샷 조회 실패 date=%s", date)
        raise HTTPException(503, "공정 DB 조회에 실패했습니다.")
    out = []
    for r in rows:
        t = r["t"]
        # DB 규칙상 한 샷은 두 테이블 중 한 곳에만 있음 (MS 11_ai.sql)
        status = "discarded" if r["discarded_at"] else "labeled" if r["labeled_at"] else "unlabeled"
        out.append({
            "castingId": r["casting_id"],
            "shotId": int(r["casting_id"].rsplit("_", 1)[-1]),   # casting_id = YYMMDD_HHMMSS_생산번호
            "time": f"{t.hour}:{t.minute:02d}:{t.second:02d}",
            "status": status,
            "types": [k.upper() for k in DEFECT_TYPES if r[k]] if status == "labeled" else [],
        })
    return out
