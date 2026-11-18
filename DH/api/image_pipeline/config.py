"""이미지 파이프라인 설정 상수 (1차 뼈대).

환경변수로 덮어쓸 수 있음. 비밀은 루트 .env 만 사용.
2차: Kafka/Flink 클라이언트 승인 후 실제 연결에 사용.
"""
from __future__ import annotations

import os
from typing import Literal

# 토픽 T1
TOPIC_INGEST = os.environ.get("AIAX_TOPIC_IMAGE_INGEST", "aiax.image.ingest")
TOPIC_MES_WRITE = os.environ.get("AIAX_TOPIC_IMAGE_MES_WRITE", "aiax.image.mes_write")
TOPIC_SPARK_SYNC = os.environ.get("AIAX_TOPIC_IMAGE_SPARK_SYNC", "aiax.image.spark_sync")

# 싱크 모드: A = Flink가 mes 직접 INSERT / B = writer가 INSERT
SinkMode = Literal["A", "B"]
DEFAULT_SINK_MODE: SinkMode = "A"  # O3 확정

# 페이로드: E1a = JSON 메타 + Base64
PAYLOAD_ENCODING = "E1a"

# 테이블 (MS init 반영 전에도 이름은 고정)
MES_IMAGE_TABLE = "mes.casting_image"
LAKE_IMAGE_TABLE = "lake.lake_casting_image"

# Kafka 브로커 (타 PC Docker 기본)
KAFKA_BOOTSTRAP = os.environ.get("AIAX_KAFKA_BOOTSTRAP", "localhost:9094")

# mes 적재 계정 (루트 .env 의 DATABASE/APP_MES — 2차에서 연결)
MES_DATABASE_URL = os.environ.get("AIAX_MES_DATABASE_URL") or os.environ.get("DATABASE_URL", "")


def sink_mode() -> SinkMode:
    raw = (os.environ.get("AIAX_IMAGE_SINK_MODE") or DEFAULT_SINK_MODE).upper()
    if raw not in ("A", "B"):
        return DEFAULT_SINK_MODE
    return raw  # type: ignore[return-value]


def public_config() -> dict:
    """API/지침용 — 비밀번호 없음."""
    return {
        "phase": 1,
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
        "mes_database_url_configured": bool(MES_DATABASE_URL),
        "note": "original_uri 는 기록만. 로드는 lake.lake_casting_image.image_base64. 2차 실연동은 별도 지시 후",
    }
