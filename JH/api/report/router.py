"""경영 관리자 리포트 API — 서버 실제 값 (읽기 전용 계정 app_lake)

생산량·최종 불량 = mes.investment_casting (세 라인 합계, 불량 = 실제 판정 passorfail = 1)
안전 = ai.ppe_check — 판정·위반 기준은 보호구 착용 위반 API(ppe/router.py CHECKS·VIOLATION) 그대로 (두 화면 숫자 일치)
화면: JH/frontend/pages/management_report — 날짜별 값을 받아 일일·주간·월간 리포트 기간으로 합산
근태·SPC·1차 불량·재활용·불량 유형은 아직 화면 목업.
"""
from __future__ import annotations

import logging
from datetime import date as Date

from fastapi import APIRouter, HTTPException, Query

from common.db import connect
from ppe.router import CHECKS, GEARS, VIOLATION

router = APIRouter(prefix="/api/report")
log = logging.getLogger("jh.report")
DB = "DATABASE_URL"   # app_lake — mes·ai·lake 읽기만
MAX_RANGE_DAYS = 220  # 월간 목록(7개월) 한 번에 조회


def _check_range(start: Date, end: Date) -> None:
    if end < start:
        raise HTTPException(400, "종료일이 시작일보다 빠릅니다.")
    if (end - start).days + 1 > MAX_RANGE_DAYS:
        raise HTTPException(400, f"기간은 최대 {MAX_RANGE_DAYS}일까지 조회할 수 있습니다.")


@router.get("/daily")
def daily(start: Date = Query(alias="from"), end: Date = Query(alias="to")) -> list[dict]:
    """기간(from~to, 양 끝 포함) 날짜별 생산량·불량 (날짜 오름차순, 생산 없는 날은 빠짐)"""
    _check_range(start, end)
    try:
        with connect(DB) as conn:
            rows = conn.execute(
                """SELECT "timestamp" AS d, count(*) AS production, count(*) FILTER (WHERE passorfail = 1) AS defects
                   FROM mes.investment_casting WHERE "timestamp" BETWEEN %s AND %s GROUP BY 1 ORDER BY 1""",
                (start, end),
            ).fetchall()
    except Exception:
        log.exception("리포트 생산 집계 실패 from=%s to=%s", start, end)
        raise HTTPException(503, "생산 데이터 조회에 실패했습니다.")
    return [{"date": r["d"].isoformat(), "production": r["production"], "defects": r["defects"]} for r in rows]


@router.get("/safety")
def safety(start: Date = Query(alias="from"), end: Date = Query(alias="to")) -> dict:
    """기간 안전 원자료 — 날짜별 판정 수 + 위반 건 목록(누가·소속·미착용 장구). 재위반·업체별·장구별 합산은 화면이 리포트 기간별로"""
    _check_range(start, end)
    try:
        with connect(DB) as conn:
            scans = conn.execute(
                CHECKS + "SELECT work_date AS d, count(*) AS n FROM checks c WHERE work_date BETWEEN %s AND %s GROUP BY 1 ORDER BY 1",
                (start, end),
            ).fetchall()
            violations = conn.execute(
                CHECKS + f"SELECT * FROM checks c WHERE work_date BETWEEN %s AND %s AND {VIOLATION} ORDER BY work_date, id",
                (start, end),
            ).fetchall()
    except Exception:
        log.exception("리포트 안전 집계 실패 from=%s to=%s", start, end)
        raise HTTPException(503, "안전 데이터 조회에 실패했습니다.")
    return {
        "scans": [{"date": r["d"].isoformat(), "count": r["n"]} for r in scans],
        # 미착용 = 장구 판정 false (null = 판정 불가는 미착용으로 세지 않음)
        "violations": [
            {"date": r["work_date"].isoformat(), "userId": r["user_id"], "company": r["company"], "vendor": r["vendor"],
             "missing": [g for g in GEARS if r[g] is False]}
            for r in violations
        ],
    }
