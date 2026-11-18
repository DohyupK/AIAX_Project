"""모드 A Flink 역할 — ingest 소비 → mes INSERT → spark_sync 신호.

실행 (DH/api):
  uv run python -m image_pipeline.flink_role_a
"""
from __future__ import annotations

import logging
from typing import Any

from . import config
from .env_load import load_root_env
from .kafka_io import consume_loop, publish_json
from .payload import parse_ingest
from . import db

log = logging.getLogger("dh.image_pipeline.flink_role_a")


def process_ingest(raw: dict[str, Any]) -> None:
    """1건: 검증 → mes UPSERT → spark_sync."""
    mode = config.sink_mode()
    if mode != "A":
        raise RuntimeError(f"flink_role_a 는 모드 A 전용 (현재={mode}). 모드 B 실구현은 이번 범위 밖")

    payload = parse_ingest(raw)
    db.mes_upsert_image(payload)
    publish_json(
        config.TOPIC_SPARK_SYNC,
        {"casting_id": payload.casting_id, "op": "upsert"},
        key=payload.casting_id,
    )
    log.info("mode=A done casting_id=%s → %s", payload.casting_id, config.TOPIC_SPARK_SYNC)


def main() -> None:
    load_root_env()
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
    log.info(
        "Flink역할 A 기동 bootstrap=%s topic=%s group=%s",
        config.KAFKA_BOOTSTRAP,
        config.TOPIC_INGEST,
        config.CONSUMER_GROUP_FLINK,
    )
    consume_loop(
        group_id=config.CONSUMER_GROUP_FLINK,
        topics=[config.TOPIC_INGEST],
        handler=process_ingest,
    )


if __name__ == "__main__":
    main()
