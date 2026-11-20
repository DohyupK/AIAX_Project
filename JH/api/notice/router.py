"""메인 대시보드 일일 공정 알람 공지 — GET /api/main/daily-notice

전날(KST) mes 샷 → 관리도 알림 판정 → LLM 요약 → org.process_alert_daily_notice 캐시.
캐시 히트면 DB만 읽고 반환. 테이블 미적용·LLM 실패 시 503 (프론트는 하드코딩 공지만 표시).
"""
from __future__ import annotations

import logging
from datetime import date, datetime, timedelta
from typing import Any
from zoneinfo import ZoneInfo

from fastapi import APIRouter, HTTPException
from psycopg.types.json import Jsonb

from casting import spc
from casting.alerts_daily import AlertCard, build_alert_cards, summarize_stats
from casting.router import SHOT_COLS, to_shot
from common.db import connect
from notice.summarize import empty_notice, summarize_alerts

router = APIRouter(prefix="/api/main")
log = logging.getLogger("jh.notice")
DB = "DATABASE_URL"  # app_lake — mes 읽기 + org.process_alert_daily_notice 쓰기(GRANT 후)
LINES = ("line_no1", "line_no2", "line_no3")
KST = ZoneInfo("Asia/Seoul")
TABLE = "org.process_alert_daily_notice"


def _kst_today() -> date:
    return datetime.now(KST).date()


def _row_to_notice(row: dict) -> dict:
    d: date = row["notice_date"]
    return {
        "id": int(d.strftime("%Y%m%d")),
        "tag": row["tag"],
        "title": row["title"],
        "date": d.isoformat(),
        "content": row["content"],
    }


def _fetch_cached(conn, notice_date: date) -> dict | None:
    row = conn.execute(
        f"SELECT notice_date, source_date, tag, title, content, stats, model "
        f"FROM {TABLE} WHERE notice_date = %s",
        (notice_date,),
    ).fetchone()
    return dict(row) if row else None


def _load_shots(conn, line: str, source_date: date) -> list[dict]:
    """알림 판정용 샷 — ML 점수 불필요, features만 채움."""
    rows = conn.execute(
        f'SELECT {SHOT_COLS} FROM mes.investment_casting WHERE line_unit = %s AND "timestamp" = %s '
        "ORDER BY date, production_count",
        (line, source_date),
    ).fetchall()
    return [to_shot(r, 0.0) for r in rows]


def _collect_cards(conn, source_date: date) -> list[AlertCard]:
    cards: list[AlertCard] = []
    iso = source_date.isoformat()
    for line in LINES:
        lim = spc.limits(line)
        if not lim:
            continue
        shots = _load_shots(conn, line, source_date)
        cards.extend(build_alert_cards(shots, lim, iso))
    return cards


def _insert_notice(
    conn,
    notice_date: date,
    source_date: date,
    tag: str,
    title: str,
    content: str,
    stats: dict[str, Any],
    model: str | None,
) -> None:
    conn.execute(
        f"INSERT INTO {TABLE} (notice_date, source_date, tag, title, content, stats, model) "
        "VALUES (%s, %s, %s, %s, %s, %s, %s) ON CONFLICT (notice_date) DO NOTHING",
        (notice_date, source_date, tag, title, content, Jsonb(stats), model),
    )


def _generate(conn, notice_date: date, source_date: date) -> dict:
    cards = _collect_cards(conn, source_date)
    stats = summarize_stats(cards)
    if not cards:
        title, content = empty_notice(source_date.isoformat())
        model = None
    else:
        try:
            title, content, model = summarize_alerts(source_date.isoformat(), cards, stats)
        except Exception:
            log.exception("일일 공지 LLM 요약 실패 notice=%s source=%s", notice_date, source_date)
            raise HTTPException(503, "일일 공지 생성에 실패했습니다.")
    _insert_notice(conn, notice_date, source_date, "필독", title, content, stats, model)
    row = _fetch_cached(conn, notice_date)
    if row:
        return _row_to_notice(row)
    # 동시 요청이 ON CONFLICT 로 다른 행을 넣은 경우 등 — 생성 결과로 응답
    return {
        "id": int(notice_date.strftime("%Y%m%d")),
        "tag": "필독",
        "title": title,
        "date": notice_date.isoformat(),
        "content": content,
    }


@router.get("/daily-notice")
def daily_notice() -> dict:
    """오늘(KST) 표시용 전날 알람 AI 공지. 캐시 없으면 생성."""
    notice_date = _kst_today()
    source_date = notice_date - timedelta(days=1)
    try:
        with connect(DB) as conn:
            cached = _fetch_cached(conn, notice_date)
            if cached:
                return _row_to_notice(cached)
            return _generate(conn, notice_date, source_date)
    except HTTPException:
        raise
    except Exception as e:
        # 테이블 없음·권한 없음 등
        msg = str(e).lower()
        if "process_alert_daily_notice" in msg or "does not exist" in msg or "permission" in msg:
            log.exception("일일 공지 테이블 미적용·권한 없음 notice=%s", notice_date)
            raise HTTPException(
                503,
                "일일 공지 테이블이 아직 없습니다. MS init(org.process_alert_daily_notice) 적용 후 다시 시도하세요.",
            )
        log.exception("일일 공지 조회·생성 실패 notice=%s", notice_date)
        raise HTTPException(503, "일일 공지를 불러오지 못했습니다.")
