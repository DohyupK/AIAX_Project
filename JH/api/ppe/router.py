"""보호구 착용 위반 API — 판정은 ai.ppe_check, 출입·사람·소속은 org 원본 실시간 (읽기 전용 계정 app_lake)

화면: JH/frontend/pages/ppe_violation (검사 기록 표 · 월간 보고서)
판정(ai.ppe_check)은 게이트에서 바로 들어오므로 출입·소속도 원본을 읽어야 방금 판정된 건이 바로 보임
(lake 사본은 하루 1회 복제라 다음 날에야 이어 붙음). 경영 리포트 안전(report/router.py)도 이 CHECKS 를 그대로 씀.
ponytail: 분석용으로 lake 를 다시 쓰려면 org.* 를 lake.lake_* 로 (칼럼 동일).
"""
from __future__ import annotations

import logging
import re
from datetime import date as Date

from fastapi import APIRouter, HTTPException, Query
from notion_client.errors import APIResponseError
from pydantic import BaseModel, Field

from common.db import connect
from notion_export.client import notion_http_error, require_notion, upsert_page
from notion_export.ppe_monthly import build_ppe_payload

router = APIRouter(prefix="/api/ppe")
log = logging.getLogger("jh.ppe")
DB = "DATABASE_URL"   # app_lake — ai·org 읽기만
GEARS = ("helmet", "shoes", "vest", "gloves", "goggles")
_MONTH_RE = re.compile(r"^\d{4}-\d{2}$")


class NotionPpeBody(BaseModel):
    month: str = Field(..., description="YYYY-MM")

# 판정 1건 = 1행. 사원은 출입 로그의 게이트, 하청은 카드에 열린 게이트(a 또는 b 하나)
CHECKS = """
WITH checks AS (
  SELECT p.ppe_check_idx AS id, l.work_date, l.clock_in_at AT TIME ZONE 'Asia/Seoul' AS at, l.gate,
         c.employee_no AS user_id, d.dept_name AS company, false AS vendor,
         p.helmet, p.shoes, p.vest, p.gloves, p.goggles, p.result, p.manual_result, p.manual_by
  FROM ai.ppe_check p
  JOIN org.employee_gate_log l USING (employee_gate_log_idx)
  JOIN org.employee_card c ON c.card_id = l.employee_card_id
  JOIN org.employee e ON e.employee_no = c.employee_no
  JOIN org.department d ON d.dept_code = e.dept_code
  UNION ALL
  SELECT p.ppe_check_idx, l.work_date, l.clock_in_at AT TIME ZONE 'Asia/Seoul',
         CASE WHEN g.gate_a THEN 'a' ELSE 'b' END,
         l.vendor_card_id, v.vendor_name, true,
         p.helmet, p.shoes, p.vest, p.gloves, p.goggles, p.result, p.manual_result, p.manual_by
  FROM ai.ppe_check p
  JOIN org.vendor_gate_log l USING (vendor_gate_log_idx)
  JOIN org.vendor_worker w ON w.card_id = l.vendor_card_id
  JOIN org.vendor_company v ON v.vendor_code = w.vendor_code
  JOIN org.gate_card g ON g.vendor_card_id = l.vendor_card_id
)
"""
# 위반 = 카메라 판정 위반 또는 판정 불가 건을 안전관리자가 위반으로 확인
VIOLATION = "(c.result = 'violation' OR c.manual_result = 'violation')"


def _query(sql: str, params: tuple = ()) -> list[dict]:
    try:
        with connect(DB) as conn:
            return conn.execute(sql, params).fetchall()
    except Exception:
        log.exception("보호구 DB 조회 실패 params=%s", params)
        raise HTTPException(503, "보호구 DB 조회에 실패했습니다.")


@router.get("/dates")
def dates() -> list[str]:
    """검사 기록이 있는 날짜 (최근 날짜가 먼저)"""
    rows = _query(CHECKS + "SELECT DISTINCT work_date AS d FROM checks ORDER BY 1 DESC")
    return [r["d"].isoformat() for r in rows]


MAX_RANGE_DAYS = 92   # 한 번에 조회하는 기간 상한 (응답·화면 표 크기 제한)


@router.get("/checks")
def checks(start: Date = Query(alias="from"), end: Date = Query(alias="to")) -> list[dict]:
    """기간(from~to, 양 끝 포함) 검사 기록 (최신순). 장구 값: true 착용 / false 미착용 / null 판정 불가"""
    if end < start:
        raise HTTPException(400, "종료일이 시작일보다 빠릅니다.")
    if (end - start).days + 1 > MAX_RANGE_DAYS:
        raise HTTPException(400, f"기간은 최대 {MAX_RANGE_DAYS}일까지 조회할 수 있습니다.")
    rows = _query(
        CHECKS + "SELECT * FROM checks WHERE work_date BETWEEN %s AND %s ORDER BY at DESC, id DESC", (start, end)
    )
    return [
        {
            "id": r["id"], "date": r["work_date"].isoformat(), "time": r["at"].strftime("%H:%M:%S"),
            "userId": r["user_id"], "gate": r["gate"], "company": r["company"], "vendor": r["vendor"],
            "gears": {g: r[g] for g in GEARS},
            "result": r["result"], "manualResult": r["manual_result"], "manualBy": r["manual_by"],
        }
        for r in rows
    ]


@router.get("/monthly")
def monthly() -> list[dict]:
    """월간 보고서 원자료 (월 오름차순). 비율·합계·전월 대비는 프런트 monthly.ts 가 계산"""
    months = _query(CHECKS + """
      SELECT to_char(work_date, 'YYYY-MM') AS month, min(work_date) AS d_from, max(work_date) AS d_to,
             count(DISTINCT work_date) AS days, count(DISTINCT user_id) AS entered
      FROM checks GROUP BY 1 ORDER BY 1""")
    units = _query(CHECKS + f"""
      SELECT to_char(work_date, 'YYYY-MM') AS month, company, vendor, gate,
             count(*) AS scans, count(*) FILTER (WHERE {VIOLATION}) AS violations
      FROM checks c GROUP BY 1, 2, 3, 4""")
    # 보호구별 미착용 = 위반 건 중 그 게이트에서 필수인데 미착용(false). 판정 불가(null)는 세지 않음
    gear_cols = ", ".join(
        f"count(*) FILTER (WHERE NOT c.vendor AND r.{g} AND c.{g} IS FALSE) AS {g}_hq, "
        f"count(*) FILTER (WHERE c.vendor AND r.{g} AND c.{g} IS FALSE) AS {g}_sub"
        for g in GEARS
    )
    gears = _query(CHECKS + f"""
      SELECT to_char(work_date, 'YYYY-MM') AS month, {gear_cols}
      FROM checks c JOIN ai.ppe_gate_rule r ON r.gate = c.gate
      WHERE {VIOLATION} GROUP BY 1""")
    slots = _query(CHECKS + f"""
      SELECT to_char(work_date, 'YYYY-MM') AS month, extract(hour FROM at)::int AS hour, count(*) AS violations
      FROM checks c WHERE {VIOLATION} GROUP BY 1, 2""")
    # 카메라 대상 등록 인원 = 주조팀(casting*) 재직 사원 + 그 달에 쓰던 하청 카드
    registered = _query("""
      SELECT m.month,
             (SELECT count(*) FROM org.employee e JOIN org.team t USING (team_code)
               WHERE t.team_name LIKE 'casting%%'
                 AND (e.employment_status = 'active' OR e.resigned_at >= m.d_start)) +
             (SELECT count(*) FROM org.vendor_worker w
               WHERE w.card_issued_at < m.d_start + interval '1 month'
                 AND (w.card_returned_at IS NULL OR w.card_returned_at >= m.d_start)) AS registered
      FROM (SELECT to_char(d, 'YYYY-MM') AS month, d::date AS d_start
            FROM unnest(%s::date[]) AS d) m""", ([Date.fromisoformat(r["month"] + "-01") for r in months],))
    reg = {r["month"]: r["registered"] for r in registered}
    gear_by = {r["month"]: r for r in gears}

    out = []
    for m in months:
        k = m["month"]
        g = gear_by.get(k, {})
        out.append({
            "month": k, "from": m["d_from"].isoformat(), "to": m["d_to"].isoformat(), "days": m["days"],
            "registered": reg.get(k, 0), "entered": m["entered"],
            "units": [
                {"name": u["company"], "type": "협력업체" if u["vendor"] else "본청", "gate": u["gate"],
                 "scans": u["scans"], "violations": u["violations"]}
                for u in units if u["month"] == k
            ],
            "gears": {x: {"hq": g.get(f"{x}_hq", 0), "sub": g.get(f"{x}_sub", 0)} for x in GEARS},
            "slots": sorted(
                ({"hour": s["hour"], "violations": s["violations"]} for s in slots if s["month"] == k),
                key=lambda s: (-s["violations"], s["hour"]),
            ),
        })
    return out


@router.post("/notion")
def notion_ppe(body: NotionPpeBody) -> dict:
    """선택한 월의 보호구 착용 위반 보고서를 노션에 생성·갱신 (화면 「노션으로 보내기」)."""
    if not _MONTH_RE.match(body.month):
        raise HTTPException(400, "month 는 YYYY-MM 형식이어야 합니다.")
    try:
        notion, parent = require_notion("NOTION_PARENT_PAGE_ID")
    except RuntimeError as e:
        raise HTTPException(503, str(e)) from e

    try:
        all_raw = monthly()
        if not any(r["month"] == body.month for r in all_raw):
            raise HTTPException(404, f"{body.month} 월 보고서 원자료가 없습니다.")
        title, children = build_ppe_payload(body.month, all_raw)
        result = upsert_page(notion, parent, title, children)
    except HTTPException:
        raise
    except APIResponseError as e:
        log.exception("보호구 보고서 노션 전송 실패 month=%s", body.month)
        raise HTTPException(502, notion_http_error(e)) from e
    except Exception:
        log.exception("보호구 보고서 노션 전송 실패 month=%s", body.month)
        raise HTTPException(503, "보호구 보고서 노션 전송에 실패했습니다.") from None

    log.info("보호구 보고서 노션 %s month=%s page=%s", "생성" if result["created"] else "갱신", body.month, result["page_id"])
    return {"ok": True, "month": body.month, "title": title, **result}
