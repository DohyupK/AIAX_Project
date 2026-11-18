"""spark_sync 소비 → mes.casting_image 최신건을 lake 로 UPSERT (app_spark).

original_uri 로 HTTP 로드하지 않음. 기존 일일 lake_sync 와 별개.

실행 (DH/api):
  uv run python -m image_pipeline.lake_sync_consumer
"""
from __future__ import annotations

import logging
from typing import Any

from . import config
from . import db
from .env_load import load_root_env
from .kafka_io import consume_loop

log = logging.getLogger("dh.image_pipeline.lake_sync")


def process_spark_sync(raw: dict[str, Any]) -> None:
    cid = str(raw.get("casting_id") or "").strip()
    if not cid:
        raise ValueError("spark_sync 메시지에 casting_id 필요")
    op = str(raw.get("op") or "upsert")
    if op != "upsert":
        log.warning("알 수 없는 op=%s casting_id=%s — upsert 로 처리", op, cid)
    n = db.lake_upsert_from_mes(cid)
    if n == 0:
        # mes 에 행이 없으면 rowcount 0 가능 — 실패로 취급해 재시도
        raise RuntimeError(f"lake UPSERT 영향 0행 — mes 에 casting_id={cid} 없음?")
    log.info("lake sync done casting_id=%s", cid)


def main() -> None:
    load_root_env()
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
    log.info(
        "lake_sync 기동 bootstrap=%s topic=%s group=%s",
        config.KAFKA_BOOTSTRAP,
        config.TOPIC_SPARK_SYNC,
        config.CONSUMER_GROUP_LAKE,
    )
    consume_loop(
        group_id=config.CONSUMER_GROUP_LAKE,
        topics=[config.TOPIC_SPARK_SYNC],
        handler=process_spark_sync,
    )


if __name__ == "__main__":
    main()
