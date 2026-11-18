"""DH 이미지 파이프라인 (Kafka → Flink → mes → Spark → lake).

1차: 설정·페이로드·모드 A/B 뼈대·상태 API.
2차: Kafka/Flink/DB 실연동 (라이브러리 승인 후).
타 팀: 이 패키지·지침을 참조.
"""
from .config import public_config, sink_mode
from .payload import ImageIngestPayload, parse_ingest
from .pipeline import handle_ingest_message

__all__ = [
    "ImageIngestPayload",
    "handle_ingest_message",
    "parse_ingest",
    "public_config",
    "sink_mode",
]
