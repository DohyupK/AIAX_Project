"""Postgres 접속 — mes(app_mes) / lake(app_spark). 커넥션은 호출측에서 닫기."""
from __future__ import annotations

import logging

import psycopg

from . import config
from .payload import ImageIngestPayload, UPSERT_LAKE_SQL, UPSERT_MES_SQL

log = logging.getLogger("dh.image_pipeline.db")


def connect_mes() -> psycopg.Connection:
    url = config.mes_database_url()
    if not url:
        raise RuntimeError("mes DB URL 없음 — AIAX_MES_DATABASE_URL 또는 DATABASE_URL+APP_MES_PASSWORD")
    return psycopg.connect(url, connect_timeout=15)


def connect_spark() -> psycopg.Connection:
    url = config.spark_database_url()
    if not url:
        raise RuntimeError("spark DB URL 없음 — AIAX_SPARK_DATABASE_URL 또는 DATABASE_URL+APP_SPARK_PASSWORD")
    return psycopg.connect(url, connect_timeout=15)


def mes_upsert_image(payload: ImageIngestPayload) -> None:
    """mes.casting_image UPSERT (app_mes). FK: casting_id ∈ investment_casting."""
    with connect_mes() as conn:
        with conn.cursor() as cur:
            cur.execute(
                UPSERT_MES_SQL,
                (
                    payload.casting_id,
                    payload.original_uri,
                    payload.content_type,
                    payload.image_base64,
                ),
            )
        conn.commit()
    log.info("mes UPSERT ok casting_id=%s", payload.casting_id)


def lake_upsert_from_mes(casting_id: str) -> int:
    """mes → lake 최신 1건 복제 (app_spark). 영향 행 수 반환."""
    with connect_spark() as conn:
        with conn.cursor() as cur:
            cur.execute(UPSERT_LAKE_SQL, (casting_id,))
            n = cur.rowcount
        conn.commit()
    log.info("lake UPSERT ok casting_id=%s rowcount=%s", casting_id, n)
    return n
