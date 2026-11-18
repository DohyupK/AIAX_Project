"""파이프라인 뼈대 — 모드 A/B 분기. 실제 Kafka/Flink/DB 는 2차 지시 후.

흐름 (확정):
  ingest → Flink 고름 → [A: mes INSERT | B: mes_write 토픽 → writer mes INSERT]
         → spark_sync 신호 → Spark: 해당 casting_id 최신건 lake 복제
"""
from __future__ import annotations

import logging
from typing import Any

from . import config
from .payload import ImageIngestPayload, UPSERT_LAKE_SQL, UPSERT_MES_SQL, parse_ingest

log = logging.getLogger("dh.image_pipeline")


class Phase2Required(RuntimeError):
    """2차 구현 지시 후에만 채움. 1차에서는 의도적으로 막음."""


def handle_ingest_message(raw: dict[str, Any], *, mode: str | None = None) -> dict[str, Any]:
    """유입 1건 처리 뼈대. 검증까지 하고 DB/Kafka 는 단계 표시만."""
    payload = parse_ingest(raw)
    m = (mode or config.sink_mode()).upper()
    if m == "A":
        return _mode_a(payload)
    if m == "B":
        return _mode_b(payload)
    raise ValueError(f"알 수 없는 sink mode: {m}")


def _mode_a(payload: ImageIngestPayload) -> dict[str, Any]:
    """Flink(또는 동일 역할)가 mes 직접 INSERT 후 spark_sync."""
    log.info(
        "mode=A casting_id=%s → mes INSERT 예정 → topic=%s",
        payload.casting_id,
        config.TOPIC_SPARK_SYNC,
    )
    return {
        "ok": True,
        "phase": 1,
        "mode": "A",
        "casting_id": payload.casting_id,
        "steps": [
            {"step": "validate_E1a", "status": "done"},
            {"step": "mes_insert", "status": "phase2", "sql": "UPSERT_MES_SQL", "account": "app_mes"},
            {"step": "spark_sync_signal", "status": "phase2", "topic": config.TOPIC_SPARK_SYNC},
            {"step": "lake_replicate_latest", "status": "phase2", "account": "app_spark"},
        ],
        "mes_sql": UPSERT_MES_SQL.strip(),
        "lake_sql": UPSERT_LAKE_SQL.strip(),
    }


def _mode_b(payload: ImageIngestPayload) -> dict[str, Any]:
    """Flink는 mes_write 토픽만 → writer 가 mes INSERT → spark_sync."""
    log.info(
        "mode=B casting_id=%s → topic=%s → writer mes INSERT → topic=%s",
        payload.casting_id,
        config.TOPIC_MES_WRITE,
        config.TOPIC_SPARK_SYNC,
    )
    return {
        "ok": True,
        "phase": 1,
        "mode": "B",
        "casting_id": payload.casting_id,
        "steps": [
            {"step": "validate_E1a", "status": "done"},
            {"step": "publish_mes_write", "status": "phase2", "topic": config.TOPIC_MES_WRITE},
            {"step": "writer_mes_insert", "status": "phase2", "sql": "UPSERT_MES_SQL", "account": "app_mes"},
            {"step": "spark_sync_signal", "status": "phase2", "topic": config.TOPIC_SPARK_SYNC},
            {"step": "lake_replicate_latest", "status": "phase2", "account": "app_spark"},
        ],
        "mes_sql": UPSERT_MES_SQL.strip(),
        "lake_sql": UPSERT_LAKE_SQL.strip(),
    }


def mes_insert_phase2(_payload: ImageIngestPayload) -> None:
    """2차: 사용자가 2차 구현을 지시한 뒤에만 구현."""
    raise Phase2Required("mes INSERT 는 2차 — 2차 구현 지시 후 진행")


def emit_spark_sync_phase2(_casting_id: str) -> None:
    """2차: 사용자가 2차 구현을 지시한 뒤에만 구현."""
    raise Phase2Required("spark_sync 신호는 2차 — 2차 구현 지시 후 진행")


def lake_replicate_latest_phase2(_casting_id: str) -> None:
    """2차: 사용자가 2차 구현을 지시한 뒤에만 구현."""
    raise Phase2Required("lake 복제는 2차 — 2차 구현 지시 후 진행")
