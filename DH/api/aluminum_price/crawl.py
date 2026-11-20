"""크롤 오케스트레이션 — 백필(CSV) / 일일(DB 직접)."""
from __future__ import annotations

import logging
import time
from pathlib import Path

from . import csv_out, db, fetch
from .parse import AlRow

log = logging.getLogger("dh.aluminum_price.crawl")

DEFAULT_MAX_PAGE = 298
PAGE_SLEEP_SEC = 0.5


def backfill_to_csv(
    *,
    max_page: int = DEFAULT_MAX_PAGE,
    csv_path: Path | None = None,
) -> dict:
    """p.1~max_page 수집 → CSV. org INSERT 없음 (MS 적재)."""
    all_rows: list[AlRow] = []
    failed: list[int] = []
    for page in range(1, max_page + 1):
        try:
            rows = fetch.fetch_al_rows(page)
            if not rows:
                log.warning("page=%s 빈 표", page)
            all_rows.extend(rows)
        except Exception as e:
            log.exception("page=%s 실패", page)
            failed.append(page)
            log.error("page=%s err=%s", page, e)
        time.sleep(PAGE_SLEEP_SEC)
    path = csv_out.write_backfill_csv(all_rows, csv_path)
    return {
        "ok": len(failed) == 0,
        "mode": "backfill_csv",
        "pages": max_page,
        "row_count": len({r.price_date for r in all_rows}),
        "csv_path": str(path),
        "failed_pages": failed,
    }


def daily_to_db() -> dict:
    """p.1만 가져와 MAX(price_date) 보다 새 일자만 org INSERT. CSV 없음."""
    watermark = db.max_price_date()
    rows = fetch.fetch_al_rows(1)
    inserted = db.insert_new_rows(rows, after=watermark)
    newest = max((r.price_date for r in rows), default=None)
    return {
        "ok": True,
        "mode": "daily_db",
        "watermark": watermark.isoformat() if watermark else None,
        "page1_rows": len(rows),
        "inserted": inserted,
        "page1_newest": newest.isoformat() if newest else None,
    }
