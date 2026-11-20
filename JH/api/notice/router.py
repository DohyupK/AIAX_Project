"""메인 대시보드 일일 공정 알람 공지 — GET /api/main/daily-notice

전날(KST) mes 샷 → 관리도 알림 판정 → LLM 요약 → 응답. DB에 저장하지 않음.
캐시는 각 브라우저가 그날(KST) 한 번 받아 localStorage에 보관 (JH/frontend/pages/main_dashboard/noticeApi.ts).
샷 조회·LLM 실패 시 503 (프론트는 하드코딩 공지만 표시).
"""
from __future__ import annotations

import logging
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

from fastapi import APIRouter, HTTPException

from casting import spc
from casting.alerts_daily import AlertCard, build_alert_cards, summarize_stats
from casting.router import SHOT_COLS, to_shot
from common.db import connect
from notice.summarize import empty_notice, summarize_alerts

router = APIRouter(prefix="/api/main")
log = logging.getLogger("jh.notice")
DB = "DATABASE_URL"  # app_lake — mes 읽기만
LINES = ("line_no1", "line_no2", "line_no3")
KST = ZoneInfo("Asia/Seoul")


def _load_shots(conn, line: str, source_date: date) -> list[dict]:
    """알림 판정용 샷 — ML 점수 불필요, features만 채움."""
    rows = conn.execute(
        f'SELECT {SHOT_COLS} FROM mes.investment_casting WHERE line_unit = %s AND "timestamp" = %s '
        "ORDER BY date, production_count",
        (line, source_date),
    ).fetchall()
    return [to_shot(r, 0.0) for r in rows]


def _collect_cards(source_date: date) -> list[AlertCard]:
    cards: list[AlertCard] = []
    iso = source_date.isoformat()
    with connect(DB) as conn:   # LLM 호출 전에 커넥션 반납
        for line in LINES:
            lim = spc.limits(line)
            if not lim:
                continue
            cards.extend(build_alert_cards(_load_shots(conn, line, source_date), lim, iso))
    return cards


@router.get("/daily-notice")
def daily_notice() -> dict:
    """오늘(KST) 표시용 전날 알람 AI 공지 — 호출마다 생성 (캐시는 브라우저 몫)"""
    notice_date = datetime.now(KST).date()
    source_date = notice_date - timedelta(days=1)
    try:
        cards = _collect_cards(source_date)
    except Exception:
        log.exception("일일 공지 샷 조회 실패 source=%s", source_date)
        raise HTTPException(503, "전날 공정 데이터를 불러오지 못했습니다.")
    if cards:
        try:
            title, content, _ = summarize_alerts(source_date.isoformat(), cards, summarize_stats(cards))
        except Exception:
            log.exception("일일 공지 LLM 요약 실패 source=%s", source_date)
            raise HTTPException(503, "일일 공지 요약에 실패했습니다.")
    else:
        title, content = empty_notice(source_date.isoformat())
    return {
        "id": int(notice_date.strftime("%Y%m%d")),
        "tag": "필독",
        "title": title,
        "date": notice_date.isoformat(),
        "content": content,
    }
