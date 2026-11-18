"""DH 이미지 파이프라인 (Kafka → Flink역할 → mes → spark_sync → lake).

2차: Kafka/DB 실연동 (모드 A). Postgres=서버, Kafka=로컬 Docker.
"""
from .config import public_config, sink_mode
from .payload import ImageIngestPayload, parse_ingest
from .pipeline import handle_ingest_message
from .producer import publish_ingest

__all__ = [
    "ImageIngestPayload",
    "handle_ingest_message",
    "parse_ingest",
    "public_config",
    "publish_ingest",
    "sink_mode",
]
