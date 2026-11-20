"""공정(주조) 데이터 API — mes.investment_casting 원본·lake 정제본·ai 라벨을 읽기 전용 계정(app_lake)으로 조회

응답 형식은 프런트 JH/frontend/common/casting/types.ts 의 Shot 과 같음.
prob = 1차(ML) 불량 점수 (Model Management 「품질 1차 검사」 배포 모델, 없으면 기본 모델 — casting/model.py), actual = 실제 판정(passorfail).
/spc = 관리도 — 생산 흐름·생산 런 기준 EWMA·MR·넬슨 (casting/spc.py).
/limits = 알림 판정용 관리선·기준 기간 (spc.py 표 그대로, 판정은 프런트 common/casting/alerts.ts).
/live = 실시간 따라가기 (오늘 KST, 현재 시각 이전 샷만 — 증분 조회).
/demo-speed = 시연 배속(1|20) — mes.shot_generator_control ↔ MS shot_generator (공정최적화 ×20).
/second = 2차(DL) 판정 (「품질 2차 검사」 배포 모델, 없으면 기본 모델 — casting/dl_model.py, 이미지 mes.casting_image).
"""
from __future__ import annotations

import logging
from datetime import date as Date
from typing import Literal

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from casting import dl_model, model, spc
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
SHOT_COLS = ", ".join(sorted({"casting_id", "date", "production_count", "passorfail", *FEATURES.values()}))
# 오늘·지금 = DB 서버 시계 기준 KST (date 칼럼 = 하루 안 시각 time, "timestamp" 칼럼 = 생산일 date)
KST_NOW = "(now() AT TIME ZONE 'Asia/Seoul')"
LIVE_FIRST = 200     # 실시간 첫 조회 = 최근 샷 수 (관리도·알람 맥락)
LIVE_BATCH = 500     # 증분 1회 최대 샷 수
CASTING_ID = r"^L\d+_\d{6}_\d{6}_\d+$"   # casting_id = L<라인번호>_YYMMDD_HHMMSS_생산번호 (예: L2_261101_000336_1, 2026-11-19 MS 변경)


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
                # 오늘 이후 날짜는 제외 (미리 넣은 목업 미래 날짜가 기본 선택되지 않게)
                f'SELECT DISTINCT "timestamp" AS d FROM mes.investment_casting WHERE line_unit = %s AND "timestamp" <= {KST_NOW}::date ORDER BY 1 DESC',
                (line,),
            ).fetchall()
    except Exception:
        log.exception("공정 날짜 조회 실패 line=%s", line)
        raise HTTPException(503, "공정 DB 조회에 실패했습니다.")
    return [r["d"].isoformat() for r in rows]


@router.get("/predictions")
def predictions(date: Date, line: str = LINE) -> list[dict]:
    """그날 샷 전체 (시간순)"""
    try:
        with connect(DB) as conn:
            rows = conn.execute(
                f'SELECT {SHOT_COLS} FROM mes.investment_casting WHERE line_unit = %s AND "timestamp" = %s '
                "ORDER BY date, production_count",
                (line, date),
            ).fetchall()
    except Exception:
        log.exception("공정 샷 조회 실패 line=%s date=%s", line, date)
        raise HTTPException(503, "공정 DB 조회에 실패했습니다.")
    return _scored(rows, f"line={line} date={date}")


@router.get("/live")
def live(line: str = LINE, after: str | None = Query(None, pattern=CASTING_ID)) -> dict:
    """실시간 따라가기 — 오늘(KST) 샷 중 현재 시각 이전만 (시간순).
    after(마지막으로 받은 casting_id) 없음·오늘 샷이 아님 → 최근 LIVE_FIRST 샷 + reset=true (화면이 목록 교체)
    after 있음 → 그 샷 이후만 + reset=false (화면이 뒤에 붙임)"""
    try:
        with connect(DB) as conn:
            cur = after and conn.execute(
                f'SELECT date, production_count FROM mes.investment_casting '
                f'WHERE casting_id = %s AND line_unit = %s AND "timestamp" = {KST_NOW}::date',
                (after, line),
            ).fetchone()
            base = (f'SELECT {SHOT_COLS} FROM mes.investment_casting WHERE line_unit = %s '
                    f'AND "timestamp" = {KST_NOW}::date AND date <= {KST_NOW}::time')
            if cur:
                rows = conn.execute(
                    base + " AND (date, production_count) > (%s, %s) ORDER BY date, production_count LIMIT %s",
                    (line, cur["date"], cur["production_count"], LIVE_BATCH),
                ).fetchall()
            else:
                rows = conn.execute(
                    base + " ORDER BY date DESC, production_count DESC LIMIT %s", (line, LIVE_FIRST)
                ).fetchall()[::-1]
            today = conn.execute(f"SELECT {KST_NOW}::date AS d").fetchone()["d"]
    except Exception:
        log.exception("실시간 샷 조회 실패 line=%s after=%s", line, after)
        raise HTTPException(503, "공정 DB 조회에 실패했습니다.")
    return {"date": today.isoformat(), "reset": not cur, "shots": _scored(rows, f"live line={line}")}


class DemoSpeedBody(BaseModel):
    """시연 배속 — 1=실시간(~150초/샷), 20=20배속 (JH ×20 ↔ MS shot_generator)"""
    speed: Literal[1, 20] = Field(description="1 또는 20")


@router.get("/demo-speed")
def get_demo_speed() -> dict:
    """MS shot_generator 가 읽는 시연 배속 (mes.shot_generator_control)"""
    try:
        with connect(DB) as conn:
            row = conn.execute(
                "SELECT speed, updated_at FROM mes.shot_generator_control WHERE id = 1"
            ).fetchone()
    except Exception:
        log.exception("시연 배속 조회 실패")
        raise HTTPException(503, "시연 배속 조회에 실패했습니다. (init 28 적용 여부 확인)")
    if not row:
        raise HTTPException(503, "시연 배속 행이 없습니다. (mes.shot_generator_control)")
    return {"speed": int(row["speed"]), "updatedAt": row["updated_at"].isoformat()}


@router.put("/demo-speed")
def put_demo_speed(body: DemoSpeedBody) -> dict:
    """공정최적화 live ×20 — app_lake 가 control 행만 UPDATE (그 외 mes 쓰기는 없음)"""
    try:
        with connect(DB) as conn:
            row = conn.execute(
                "UPDATE mes.shot_generator_control SET speed = %s, updated_at = now() "
                "WHERE id = 1 RETURNING speed, updated_at",
                (body.speed,),
            ).fetchone()
            if not row:
                raise HTTPException(503, "시연 배속 행이 없습니다. (mes.shot_generator_control)")
    except HTTPException:
        raise
    except Exception:
        log.exception("시연 배속 저장 실패 speed=%s", body.speed)
        raise HTTPException(503, "시연 배속 저장에 실패했습니다. (권한·init 28 확인)")
    log.info("시연 배속 → %s", body.speed)
    return {"speed": int(row["speed"]), "updatedAt": row["updated_at"].isoformat()}


def _scored(rows: list[dict], ctx: str) -> list[dict]:
    """샷 행 → 화면 Shot (1차 ML 점수 포함)"""
    if not rows:
        return []
    try:
        sc = model.scores(rows)
    except model.ModelError as e:   # 배포 모델 파일·형식 문제 — 무엇이 틀렸는지 화면에 그대로
        log.error("1차 검사 배포 모델 사용 불가: %s", e)
        raise HTTPException(503, str(e))
    except Exception:
        log.exception("1차 검사 모델 점수 계산 실패 %s", ctx)
        raise HTTPException(503, "1차 검사 모델을 실행하지 못했습니다.")
    return [to_shot(r, s) for r, s in zip(rows, sc)]


SPC_CONTEXT = 6000   # 보이는 구간 앞쪽에서 런 시작을 찾을 때 조회하는 최대 샷 수 (런 최대 약 1,900샷 × 흐름 여러 개)
SPC_WINDOW_MAX = 2100  # 보이는 구간 최대 샷 수 (실시간 화면 최대 2,000샷)
SPC_KEYS = Query(pattern=r"^[A-Za-z0-9_]+$")


@router.get("/spc")
def spc_chart(line: str = LINE, key: str = SPC_KEYS,
              first: str = Query(pattern=CASTING_ID), last: str = Query(pattern=CASTING_ID)) -> dict:
    """관리도 — 보이는 구간(first~last, 시각 순)의 I·MR·EWMA 값과 표시.
    EWMA·MR·넬슨 2·3 은 생산 흐름별로 그 런의 첫 샷부터 계산 (앞쪽 샷은 서버가 조회, 보이는 구간만 돌려줌)"""
    base = spc.baseline(line, key)
    col = FEATURES.get(key)
    if not base or not col:
        raise HTTPException(404, f"{line} · {key} 는 관리도 기준선이 없습니다.")
    order = '"timestamp", date, production_count'
    try:
        with connect(DB) as conn:
            ends = {r["casting_id"]: r for r in conn.execute(
                'SELECT casting_id, "timestamp" AS d, date AS t, production_count AS p FROM mes.investment_casting '
                "WHERE line_unit = %s AND casting_id = ANY(%s)", (line, [first, last])).fetchall()}
            if first not in ends or last not in ends:
                raise HTTPException(404, "관리도 구간의 샷을 찾을 수 없습니다.")
            e = ends[last]
            rows = conn.execute(
                f'SELECT casting_id, "timestamp", date, production_count, {col} AS v FROM mes.investment_casting '
                f'WHERE line_unit = %s AND ({order}) <= (%s, %s, %s) '
                f'ORDER BY "timestamp" DESC, date DESC, production_count DESC LIMIT %s',
                (line, e["d"], e["t"], e["p"], SPC_CONTEXT + SPC_WINDOW_MAX),
            ).fetchall()[::-1]
    except HTTPException:
        raise
    except Exception:
        log.exception("관리도 조회 실패 line=%s key=%s first=%s last=%s", line, key, first, last)
        raise HTTPException(503, "공정 DB 조회에 실패했습니다.")
    start = next((i for i, r in enumerate(rows) if r["casting_id"] == first), None)
    if start is None:
        raise HTTPException(400, f"관리도 구간이 너무 깁니다 (최대 {SPC_WINDOW_MAX}샷).")
    return {"baseline": base, "lambda": spc.LAMBDA, "shots": spc.compute(rows, start, base)}


@router.get("/limits")
def control_limits(line: str = LINE) -> dict:
    """알림 판정용 관리선 — 라인별 고정 표(관리도와 같은 값) + 기준 기간. DB 조회 없음"""
    out = spc.limits(line)
    if out is None:
        raise HTTPException(404, f"{line} 는 관리선이 없습니다.")
    return out


@router.get("/model")
def model_info() -> dict:
    """1차(ML) 검사 모델 정보 — 이름·버전·출처(배포 / 기본)·기준값·검증 성적"""
    try:
        return model.info()
    except model.ModelError as e:
        log.error("1차 검사 배포 모델 사용 불가: %s", e)
        raise HTTPException(503, str(e))
    except Exception:
        log.exception("1차 검사 모델 로드 실패")
        raise HTTPException(503, "1차 검사 모델을 불러오지 못했습니다.")


# ---- 2차(DL) 검사 — mes.casting_image 이미지가 있는 샷만. 판정은 백그라운드 작업이 미리 저장 (dl_model.start_worker) ----
@router.get("/second")
def second(date: Date, line: str = LINE) -> dict:
    """그날 그 라인의 이미지 샷 중 지금 모델로 판정이 끝난 결과 + 판정 대기 샷. 1차 양품만 2차 대상인 건 화면이 거름"""
    try:
        model_meta = dl_model.info()
    except dl_model.ModelError as e:
        log.error("2차 검사 배포 모델 사용 불가: %s", e)
        raise HTTPException(503, str(e))
    except Exception:
        log.exception("2차 검사 모델 로드 실패")
        raise HTTPException(503, "2차 검사 모델을 불러오지 못했습니다.")
    try:
        with connect(DB) as conn:
            rows = conn.execute(
                """SELECT i.casting_id, i.updated_at, q.model_name, q.version, q.result, q.confidence_score,
                          q.predicted_at, q.qc1_result
                   FROM mes.casting_image i
                   JOIN mes.investment_casting m USING (casting_id)
                   LEFT JOIN ai.quality_prediction q USING (casting_id)
                   WHERE m.line_unit = %s AND m."timestamp" = %s""",
                (line, date),
            ).fetchall()
    except Exception:
        log.exception("2차 검사 결과 조회 실패 line=%s date=%s", line, date)
        raise HTTPException(503, "공정 DB 조회에 실패했습니다.")
    results, pending = [], []
    for r in rows:
        done = (r["result"] is not None and r["model_name"] == model_meta["name"]
                and r["version"] == model_meta["version"] and r["predicted_at"] >= r["updated_at"])
        if done:
            results.append({
                "castingId": r["casting_id"], "modelName": r["model_name"], "version": r["version"],
                "result": r["result"], "confidenceScore": float(r["confidence_score"]),
                "predictedAt": r["predicted_at"].isoformat(),
            })
        elif r["qc1_result"] != "fail":   # 1차 불량은 2차 대상 아님 — 대기에 넣지 않음
            pending.append(r["casting_id"])
    # pendingIds = 사진은 있는데 아직 판정 전 (화면에서 「이미지 없음」과 구분)
    return {"model": model_meta, "results": results, "pending": len(pending), "pendingIds": pending}


# ---- 불량 유형 라벨링 (2차 판정 + ai 라벨) ----
# 「불량 샷」 = 2차(DL) 판정 불량 ai.quality_prediction.result = 'fail' (/second 가 저장). 샷 날짜·시각·라인은 mes.investment_casting
# 라인별 조회 (2026-11-19 lake 재생성으로 line_no1~3 이 모두 들어옴 — 화면 라인 선택, 기본 line_no1)
DEFECT_TYPES = ("blowhole", "edge_burr", "surface_rough")   # ai.defect_label 칼럼 = 화면 코드 소문자


@router.get("/defect-dates")
def defect_dates(line: str = LINE) -> list[str]:
    """그 라인의 2차 판정 불량 샷이 있는 날짜 (최근 날짜가 먼저)"""
    try:
        with connect(DB) as conn:
            rows = conn.execute(
                'SELECT DISTINCT m."timestamp" AS d FROM ai.quality_prediction q '
                "JOIN mes.investment_casting m USING (casting_id) "
                "WHERE q.result = 'fail' AND m.line_unit = %s ORDER BY 1 DESC",
                (line,),
            ).fetchall()
    except Exception:
        log.exception("불량 날짜 조회 실패 line=%s", line)
        raise HTTPException(503, "공정 DB 조회에 실패했습니다.")
    return [r["d"].isoformat() for r in rows]


@router.get("/defects")
def defects(date: Date, line: str = LINE) -> list[dict]:
    """그 라인·그날 2차 판정 불량 샷 + 라벨 상태 (최신순). status: unlabeled / labeled / discarded"""
    try:
        with connect(DB) as conn:
            rows = conn.execute(
                """SELECT casting_id, m.date AS t, dl.blowhole, dl.edge_burr, dl.surface_rough,
                          dl.labeled_at, dd.discarded_at
                   FROM ai.quality_prediction q
                   JOIN mes.investment_casting m USING (casting_id)
                   LEFT JOIN ai.defect_label dl USING (casting_id)
                   LEFT JOIN ai.defect_discard dd USING (casting_id)
                   WHERE m."timestamp" = %s AND q.result = 'fail' AND m.line_unit = %s
                   ORDER BY m.date DESC, casting_id DESC""",
                (date, line),
            ).fetchall()
    except Exception:
        log.exception("불량 샷 조회 실패 line=%s date=%s", line, date)
        raise HTTPException(503, "공정 DB 조회에 실패했습니다.")
    out = []
    for r in rows:
        t = r["t"]
        # DB 규칙상 한 샷은 두 테이블 중 한 곳에만 있음 (MS 11_ai.sql)
        status = "discarded" if r["discarded_at"] else "labeled" if r["labeled_at"] else "unlabeled"
        out.append({
            "castingId": r["casting_id"],
            "shotId": int(r["casting_id"].rsplit("_", 1)[-1]),   # casting_id 끝 = 생산번호 (L1_YYMMDD_HHMMSS_생산번호)
            "time": f"{t.hour}:{t.minute:02d}:{t.second:02d}",
            "status": status,
            "types": [k.upper() for k in DEFECT_TYPES if r[k]] if status == "labeled" else [],
        })
    return out
