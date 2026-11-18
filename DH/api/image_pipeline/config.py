"""이미지 파이프라인 설정 (2차 실연동).

환경변수·루트 .env 로 덮어씀. 비밀은 루트 .env 만.
"""
from __future__ import annotations

import os
from typing import Literal
from urllib.parse import quote_plus, urlparse, urlunparse

from .env_load import load_root_env

load_root_env()

# 토픽 T1
TOPIC_INGEST = os.environ.get("AIAX_TOPIC_IMAGE_INGEST", "aiax.image.ingest")
TOPIC_MES_WRITE = os.environ.get("AIAX_TOPIC_IMAGE_MES_WRITE", "aiax.image.mes_write")
TOPIC_SPARK_SYNC = os.environ.get("AIAX_TOPIC_IMAGE_SPARK_SYNC", "aiax.image.spark_sync")

# 싱크 모드: A = Flink역할이 mes 직접 INSERT / B = writer가 INSERT (2차 실코드는 A만)
SinkMode = Literal["A", "B"]
DEFAULT_SINK_MODE: SinkMode = "A"

PAYLOAD_ENCODING = "E1a"

MES_IMAGE_TABLE = "mes.casting_image"
LAKE_IMAGE_TABLE = "lake.lake_casting_image"

# 로컬 Docker Kafka (postgres 는 서버)
KAFKA_BOOTSTRAP = os.environ.get("AIAX_KAFKA_BOOTSTRAP", "localhost:9094")

CONSUMER_GROUP_FLINK = os.environ.get("AIAX_IMAGE_CG_FLINK", "dh.image.flink_role_a")
CONSUMER_GROUP_LAKE = os.environ.get("AIAX_IMAGE_CG_LAKE", "dh.image.lake_sync")


def _rewrite_db_url(base: str, *, user: str, password: str) -> str:
    """DATABASE_URL 호스트·DB를 유지하고 user/password 만 교체."""
    if not base:
        return ""
    u = urlparse(base)
    host = u.hostname or "127.0.0.1"
    port = u.port or 5432
    db = (u.path or "/aiax").lstrip("/") or "aiax"
    auth = f"{quote_plus(user)}:{quote_plus(password)}"
    return urlunparse(("postgresql", f"{auth}@{host}:{port}", f"/{db}", "", "", ""))


def mes_database_url() -> str:
    """app_mes 접속. AIAX_MES_DATABASE_URL 우선, 없으면 DATABASE_URL + APP_MES_PASSWORD."""
    explicit = os.environ.get("AIAX_MES_DATABASE_URL", "").strip()
    if explicit:
        return explicit
    base = os.environ.get("DATABASE_URL", "").strip()
    pw = os.environ.get("APP_MES_PASSWORD", "")
    if base and pw:
        return _rewrite_db_url(base, user="app_mes", password=pw)
    return base


def spark_database_url() -> str:
    """app_spark 접속 (lake 쓰기). AIAX_SPARK_DATABASE_URL 우선."""
    explicit = os.environ.get("AIAX_SPARK_DATABASE_URL", "").strip()
    if explicit:
        return explicit
    base = os.environ.get("DATABASE_URL", "").strip()
    pw = os.environ.get("APP_SPARK_PASSWORD", "")
    if base and pw:
        return _rewrite_db_url(base, user="app_spark", password=pw)
    return ""


# 하위 호환: 모듈 import 시점 스냅샷 (공개 설정용)
MES_DATABASE_URL = mes_database_url()


def sink_mode() -> SinkMode:
    raw = (os.environ.get("AIAX_IMAGE_SINK_MODE") or DEFAULT_SINK_MODE).upper()
    if raw not in ("A", "B"):
        return DEFAULT_SINK_MODE
    return raw  # type: ignore[return-value]


def public_config() -> dict:
    """API/지침용 — 비밀번호 없음."""
    mes = mes_database_url()
    spark = spark_database_url()
    return {
        "phase": 2,
        "sink_mode_default": DEFAULT_SINK_MODE,
        "sink_mode": sink_mode(),
        "payload_encoding": PAYLOAD_ENCODING,
        "topics": {
            "ingest": TOPIC_INGEST,
            "mes_write": TOPIC_MES_WRITE,
            "spark_sync": TOPIC_SPARK_SYNC,
        },
        "tables": {"mes": MES_IMAGE_TABLE, "lake": LAKE_IMAGE_TABLE},
        "kafka_bootstrap": KAFKA_BOOTSTRAP,
        "mes_database_url_configured": bool(mes),
        "spark_database_url_configured": bool(spark),
        "note": "original_uri 는 기록만. 로드는 lake.lake_casting_image.image_base64. Postgres=서버, Kafka=로컬 Docker",
    }
