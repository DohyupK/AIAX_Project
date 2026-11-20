"""Shift 봇용 관리도 알림 컨텍스트 — 공정 최적화 AlertLog 와 동일 규칙(alerts_daily)."""
from __future__ import annotations

import logging
from datetime import date, datetime
from typing import Any
from zoneinfo import ZoneInfo

from casting import spc
from casting.alerts_daily import GRADE_NAME, GRADE_RANK, AlertCard, build_alert_cards
from casting.router import SHOT_COLS, to_shot
from common.db import connect

log = logging.getLogger("jh.documents.alert_context")

DB = "DATABASE_URL"  # app_lake — mes 읽기
LINES = ("line_no1", "line_no2", "line_no3")
KST = ZoneInfo("Asia/Seoul")
MAX_ALERTS = 30
GRADE_SCORE = {"alarm": 1.0, "caution": 0.7, "watch": 0.4}


def _kst_today() -> date:
    return datetime.now(KST).date()


def _latest_date(conn, line: str) -> date | None:
    row = conn.execute(
        'SELECT MAX("timestamp") AS d FROM mes.investment_casting WHERE line_unit = %s',
        [line],
    ).fetchone()
    d = row["d"] if row else None
    return d if isinstance(d, date) else None


def _load_shots(conn, line: str, day: date) -> list[dict]:
    rows = conn.execute(
        f'SELECT {SHOT_COLS} FROM mes.investment_casting WHERE line_unit = %s AND "timestamp" = %s '
        "ORDER BY date, production_count",
        (line, day),
    ).fetchall()
    return [to_shot(r, 0.0) for r in rows]


def _card_to_source(c: AlertCard) -> dict[str, Any]:
    details = " · ".join(c.details[:4]) if c.details else ""
    snippet_parts = [c.head, details, c.guide]
    if c.extra:
        snippet_parts.append(c.extra)
    snippet = "\n".join(p for p in snippet_parts if p)[:500]
    return {
        "kind": "process_alert",
        "company_document_idx": 0,
        "doc_no": f"ALERT-{c.id}",
        "title": c.title,
        "file_name": f"{c.line} · {c.date} {c.time} · #{c.shot_id}",
        "category": GRADE_NAME.get(c.grade, c.grade),
        "chunk_no": 0,
        "score": GRADE_SCORE.get(c.grade, 0.5),
        "content": snippet,
        "grade": c.grade,
        "line": c.line,
    }


def _card_block(c: AlertCard) -> str:
    details = "\n".join(f"  - {d}" for d in c.details[:6])
    extra = f"\n{c.extra}" if c.extra else ""
    return (
        f"[ALERT-{c.id}] [{GRADE_NAME.get(c.grade, c.grade)}] {c.title}\n"
        f"{c.head}\n{details}\n확인: {c.guide}{extra}"
    )


def collect_alert_context(max_alerts: int = MAX_ALERTS) -> tuple[list[dict[str, Any]], str]:
    """당일(없으면 라인별 최신일) 관리도 알림 → (sources용 dict 목록, LLM 텍스트).

    실패 시 빈 결과 (문서 검색은 계속).
    """
    try:
        today = _kst_today()
        cards: list[AlertCard] = []
        with connect(DB) as conn:
            for line in LINES:
                lim = spc.limits(line)
                if not lim:
                    continue
                day = today
                shots = _load_shots(conn, line, day)
                if not shots:
                    latest = _latest_date(conn, line)
                    if latest is None:
                        continue
                    day = latest
                    shots = _load_shots(conn, line, day)
                if not shots:
                    continue
                cards.extend(build_alert_cards(shots, lim, day.isoformat()))

        # 경보 > 주의 > 관찰, 같은 등급은 날짜·시각 순
        cards.sort(key=lambda c: (-GRADE_RANK[c.grade], c.date, c.time))
        top = cards[:max_alerts]
        sources = [_card_to_source(c) for c in top]
        blocks = [_card_block(c) for c in top]
        text = "\n\n".join(blocks) if blocks else ""
        log.info("Shift 관리도 알림 컨텍스트 %d건 (수집 %d)", len(top), len(cards))
        return sources, text
    except Exception:
        log.exception("관리도 알림 컨텍스트 수집 실패 — 문서만으로 진행")
        return [], ""
