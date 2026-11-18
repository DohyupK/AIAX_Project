"""파이프라인 — 모드 A/B 분기. 2차: A 는 DB/Kafka 실연동.

흐름:
  ingest → Flink역할 → [A: mes INSERT | B: 자리만]
         → spark_sync 신호 → lake 복제
"""
from __future__ import annotations

import logging
from typing import Any

from . import config
from . import db
from .kafka_io import publish_json
from .payload import ImageIngestPayload, UPSERT_LAKE_SQL, UPSERT_MES_SQL, parse_ingest

log = logging.getLogger("dh.image_pipeline")


def handle_ingest_message(raw: dict[str, Any], *, mode: str | None = None, dry_run: bool = False) -> dict[str, Any]:
    """유입 1건. dry_run=True 면 검증·단계 표시만. False 면 모드 A 실처리."""
    payload = parse_ingest(raw)
    m = (mode or config.sink_mode()).upper()
    if m == "A":
        return _mode_a(payload, dry_run=dry_run)
    if m == "B":
        return _mode_b(payload, dry_run=dry_run)
    raise ValueError(f"알 수 없는 sink mode: {m}")


def _mode_a(payload: ImageIngestPayload, *, dry_run: bool) -> dict[str, Any]:
    if dry_run:
        log.info("dry-run mode=A casting_id=%s", payload.casting_id)
        return {
            "ok": True,
            "phase": 2,
            "mode": "A",
            "dry_run": True,
            "casting_id": payload.casting_id,
            "steps": [
                {"step": "validate_E1a", "status": "done"},
                {"step": "mes_insert", "status": "skipped_dry_run", "account": "app_mes"},
                {"step": "spark_sync_signal", "status": "skipped_dry_run", "topic": config.TOPIC_SPARK_SYNC},
                {"step": "lake_replicate_latest", "status": "skipped_dry_run", "account": "app_spark"},
            ],
            "mes_sql": UPSERT_MES_SQL.strip(),
            "lake_sql": UPSERT_LAKE_SQL.strip(),
        }

    mes_insert(payload)
    emit_spark_sync(payload.casting_id)
    lake_replicate_latest(payload.casting_id)
    return {
        "ok": True,
        "phase": 2,
        "mode": "A",
        "dry_run": False,
        "casting_id": payload.casting_id,
        "steps": [
            {"step": "validate_E1a", "status": "done"},
            {"step": "mes_insert", "status": "done", "account": "app_mes"},
            {"step": "spark_sync_signal", "status": "done", "topic": config.TOPIC_SPARK_SYNC},
            {"step": "lake_replicate_latest", "status": "done", "account": "app_spark"},
        ],
    }


def _mode_b(payload: ImageIngestPayload, *, dry_run: bool) -> dict[str, Any]:
    """모드 B — 2차에서 실구현 안 함. dry-run 미리보기만."""
    log.info("mode=B casting_id=%s (실구현 없음, dry_run=%s)", payload.casting_id, dry_run)
    return {
        "ok": True,
        "phase": 2,
        "mode": "B",
        "dry_run": True,
        "casting_id": payload.casting_id,
        "steps": [
            {"step": "validate_E1a", "status": "done"},
            {"step": "publish_mes_write", "status": "not_implemented", "topic": config.TOPIC_MES_WRITE},
            {"step": "writer_mes_insert", "status": "not_implemented", "account": "app_mes"},
            {"step": "spark_sync_signal", "status": "not_implemented", "topic": config.TOPIC_SPARK_SYNC},
            {"step": "lake_replicate_latest", "status": "not_implemented", "account": "app_spark"},
        ],
        "note": "모드 B 실연동은 이번 범위 밖",
        "mes_sql": UPSERT_MES_SQL.strip(),
        "lake_sql": UPSERT_LAKE_SQL.strip(),
    }


def mes_insert(payload: ImageIngestPayload) -> None:
    db.mes_upsert_image(payload)


def emit_spark_sync(casting_id: str) -> None:
    publish_json(
        config.TOPIC_SPARK_SYNC,
        {"casting_id": casting_id, "op": "upsert"},
        key=casting_id,
    )


def lake_replicate_latest(casting_id: str) -> None:
    n = db.lake_upsert_from_mes(casting_id)
    if n == 0:
        raise RuntimeError(f"lake UPSERT 영향 0행 casting_id={casting_id}")
