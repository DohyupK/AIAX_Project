"""경영 관리자 리포트 API — 서버 실제 값 (읽기 전용 계정 app_lake)

생산량·최종 불량 = mes.investment_casting (세 라인 합계, 불량 = 실제 판정 passorfail = 1)
고정값(단가·재활용 회수액·재활용률·MTTR·MTBF·리콜) = org.fixed_value (적용 시작일 이력 그대로 — 화면이 리포트 기간 마지막 날 기준으로 고름)
안전 = ai.ppe_check — 판정·위반 기준은 보호구 착용 위반 API(ppe/router.py CHECKS·VIOLATION) 그대로 (두 화면 숫자 일치)
SPC 경고 알람 = mes.investment_casting × mes.spc_limit — 「샷 × 변수」 한 점이 I 관리선 밖이면 1건 (관리도 ▲ 규칙 1 과 같은 기준)
근태 = org.employee_record — 총 인원 = 그날 근무 기록이 있는 사람(근무 예정자), 출근 = 결근 아님 (org.attendance 와 1:1 일치)
화면: JH/frontend/pages/management_report — 날짜별 값을 받아 일일·주간·월간 리포트 기간으로 합산
"""
from __future__ import annotations

import logging
from datetime import date as Date
from datetime import timedelta

from fastapi import APIRouter, HTTPException, Query
from notion_client.errors import APIResponseError
from pydantic import BaseModel

from casting.router import FEATURES
from casting.spc import _TABLE as SPC_TABLE
from common.db import connect
from notion_export.client import notion_http_error, require_notion, upsert_page
from notion_export.mgmt_daily import assemble_source, build_daily_payload, target_date
from ppe.router import CHECKS, GEARS, VIOLATION

router = APIRouter(prefix="/api/report")
log = logging.getLogger("jh.report")
DB = "DATABASE_URL"   # app_lake — mes·ai·org 읽기만
MAX_RANGE_DAYS = 220  # 월간 목록(7개월) 한 번에 조회


class NotionDailyBody(BaseModel):
    """date 를 주면 그 날, 없으면 어제(KST). 크론은 body 없이 POST."""
    date: Date | None = None


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


@router.get("/fixed")
def fixed() -> list[dict]:
    """고정값 전체 (이름·값·단위·적용 시작일, 적용 시작일 오름차순)"""
    try:
        with connect(DB) as conn:
            rows = conn.execute(
                "SELECT value_name, value, unit, effective_date FROM org.fixed_value ORDER BY effective_date, fixed_value_idx"
            ).fetchall()
    except Exception:
        log.exception("리포트 고정값 조회 실패")
        raise HTTPException(503, "고정값 조회에 실패했습니다.")
    return [{"name": r["value_name"], "value": float(r["value"]), "unit": r["unit"], "effectiveDate": r["effective_date"].isoformat()}
            for r in rows]


# SPC 대상 변수 = 기준선 표의 13개 (DB 칼럼 이름 — mes.spc_limit.variable 과 같음)
_SPC_COLS = [FEATURES[k] for k in SPC_TABLE["line_no1"]]
SPC_SQL = f"""
WITH lim AS (   -- 기준선 이력: 적용 시작일 ~ 다음 적용 시작일 전까지
  SELECT line_unit, variable, i_lcl, i_ucl, effective_date,
         lead(effective_date) OVER (PARTITION BY line_unit, variable ORDER BY effective_date) AS until
  FROM mes.spc_limit
)
SELECT m."timestamp" AS d, count(*) FILTER (WHERE v.val > l.i_ucl) AS ucl, count(*) FILTER (WHERE v.val < l.i_lcl) AS lcl
FROM mes.investment_casting m
CROSS JOIN LATERAL (VALUES {", ".join(f"('{c}', m.{c})" for c in _SPC_COLS)}) AS v(variable, val)
JOIN lim l ON l.line_unit = m.line_unit AND l.variable = v.variable
          AND m."timestamp" >= l.effective_date AND (l.until IS NULL OR m."timestamp" < l.until)
WHERE m."timestamp" BETWEEN %s AND %s AND v.val IS NOT NULL
GROUP BY 1 ORDER BY 1
"""


@router.get("/spc")
def spc_alarms(start: Date = Query(alias="from"), end: Date = Query(alias="to")) -> list[dict]:
    """날짜별 SPC 경고 알람 — I 관리선 밖 「샷 × 변수」 수 (UCL 초과 / LCL 미만, 세 라인 합계, 생산 없는 날은 빠짐)"""
    _check_range(start, end)
    try:
        with connect(DB) as conn:
            rows = conn.execute(SPC_SQL, (start, end)).fetchall()
    except Exception:
        log.exception("리포트 SPC 알람 집계 실패 from=%s to=%s", start, end)
        raise HTTPException(503, "SPC 알람 집계에 실패했습니다.")
    return [{"date": r["d"].isoformat(), "ucl": r["ucl"], "lcl": r["lcl"]} for r in rows]


@router.get("/attendance")
def attendance(start: Date = Query(alias="from"), end: Date = Query(alias="to")) -> list[dict]:
    """날짜별 근태 — scheduled = 그날 근무 기록이 있는 사람(근무 예정자), present = 그중 결근 아님"""
    _check_range(start, end)
    try:
        with connect(DB) as conn:
            rows = conn.execute(
                """SELECT work_date AS d, count(*) AS scheduled, count(*) FILTER (WHERE NOT absent) AS present
                   FROM org.employee_record WHERE work_date BETWEEN %s AND %s GROUP BY 1 ORDER BY 1""",
                (start, end),
            ).fetchall()
    except Exception:
        log.exception("리포트 근태 집계 실패 from=%s to=%s", start, end)
        raise HTTPException(503, "근태 집계에 실패했습니다.")
    return [{"date": r["d"].isoformat(), "scheduled": r["scheduled"], "present": r["present"]} for r in rows]


@router.post("/notion/daily")
def notion_daily(body: NotionDailyBody = NotionDailyBody()) -> dict:
    """어제(또는 body.date) 일일 경영 리포트를 노션 부모 페이지 아래에 생성·갱신 (멱등).

    서버 크론 예: curl -X POST http://127.0.0.1:8000/api/report/notion/daily
    """
    day = body.date if body.date else target_date()
    prev = day - timedelta(days=1)
    try:
        notion, parent = require_notion("NOTION_PARENT_PAGE_ID")
    except RuntimeError as e:
        raise HTTPException(503, str(e)) from e

    try:
        # 전일 대비용으로 이틀치 원자료
        src = assemble_source(
            daily(start=prev, end=day),
            safety(start=prev, end=day),
            spc_alarms(start=prev, end=day),
            attendance(start=prev, end=day),
            fixed(),
        )
        title, children = build_daily_payload(src, day)
        result = upsert_page(notion, parent, title, children)
    except APIResponseError as e:
        log.exception("일일 경영 리포트 노션 전송 실패 day=%s", day)
        raise HTTPException(502, notion_http_error(e)) from e
    except HTTPException:
        raise
    except Exception:
        log.exception("일일 경영 리포트 노션 전송 실패 day=%s", day)
        raise HTTPException(503, "일일 경영 리포트 노션 전송에 실패했습니다.") from None

    log.info("일일 경영 리포트 노션 %s day=%s page=%s", "생성" if result["created"] else "갱신", day, result["page_id"])
    return {"ok": True, "date": day.isoformat(), "title": title, **result}
