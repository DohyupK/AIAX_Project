"""org.aluminum_price 조회·증분 INSERT (app_lake / DATABASE_URL)."""
from __future__ import annotations

import logging
import os
from datetime import date

import psycopg

from .parse import AlRow

log = logging.getLogger("dh.aluminum_price.db")

INSERT_SQL = """
INSERT INTO org.aluminum_price (price_date, price)
VALUES (%s, %s)
ON CONFLICT (price_date) DO NOTHING
"""

MAX_DATE_SQL = "SELECT MAX(price_date) FROM org.aluminum_price"

LIST_SQL = """
SELECT price_date, price
FROM org.aluminum_price
ORDER BY price_date DESC
LIMIT %s
"""


def database_url() -> str:
    url = os.environ.get("DATABASE_URL", "").strip()
    if not url:
        raise RuntimeError("DATABASE_URL 없음 — 루트 .env 확인")
    return url


def connect() -> psycopg.Connection:
    return psycopg.connect(database_url(), connect_timeout=15)


def max_price_date() -> date | None:
    with connect() as conn:
        with conn.cursor() as cur:
            cur.execute(MAX_DATE_SQL)
            row = cur.fetchone()
    if not row or row[0] is None:
        return None
    return row[0]


def insert_new_rows(rows: list[AlRow], *, after: date | None) -> int:
    """after 보다 최신인 행만 INSERT. after=None 이면 전부 시도(ON CONFLICT 스킵)."""
    targets = [r for r in rows if after is None or r.price_date > after]
    if not targets:
        return 0
    n = 0
    with connect() as conn:
        with conn.cursor() as cur:
            for r in targets:
                cur.execute(INSERT_SQL, (r.price_date, r.price))
                n += cur.rowcount
        conn.commit()
    log.info("INSERT 시도=%s 반영=%s after=%s", len(targets), n, after)
    return n


def list_prices(*, limit: int = 500) -> list[dict]:
    with connect() as conn:
        with conn.cursor() as cur:
            cur.execute(LIST_SQL, (limit,))
            rows = cur.fetchall()
    return [
        {"price_date": r[0].isoformat(), "price": float(r[1])}
        for r in rows
    ]
