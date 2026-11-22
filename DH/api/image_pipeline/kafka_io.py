"""Kafka produce/consume 헬퍼 (confluent-kafka)."""
from __future__ import annotations

import json
import logging
from typing import Any, Callable

from confluent_kafka import Consumer, KafkaError, KafkaException, Producer

from . import config

log = logging.getLogger("dh.image_pipeline.kafka")


def make_producer() -> Producer:
    return Producer(
        {
            "bootstrap.servers": config.KAFKA_BOOTSTRAP,
            "acks": "all",
            "linger.ms": 5,
        }
    )


def publish_json(topic: str, payload: dict[str, Any], *, key: str | None = None) -> None:
    """동기 flush 까지. 실패 시 예외."""
    p = make_producer()
    err_box: list[BaseException] = []

    def _cb(err, _msg) -> None:  # noqa: ANN001
        if err is not None:
            err_box.append(KafkaException(err))

    raw = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    k = key.encode("utf-8") if key else None
    p.produce(topic, value=raw, key=k, callback=_cb)
    p.flush(30)
    if err_box:
        raise err_box[0]
    log.info("published topic=%s key=%s bytes=%s", topic, key, len(raw))


def make_consumer(group_id: str, topics: list[str]) -> Consumer:
    c = Consumer(
        {
            "bootstrap.servers": config.KAFKA_BOOTSTRAP,
            "group.id": group_id,
            "auto.offset.reset": "earliest",
            "enable.auto.commit": False,
        }
    )
    c.subscribe(topics)
    return c


def consume_loop(
    *,
    group_id: str,
    topics: list[str],
    handler: Callable[[dict[str, Any]], None],
    poll_timeout: float = 1.0,
) -> None:
    """메시지 JSON 파싱 후 handler. 성공 시 commit. Ctrl+C 로 종료."""
    consumer = make_consumer(group_id, topics)
    log.info("consumer start group=%s topics=%s bootstrap=%s", group_id, topics, config.KAFKA_BOOTSTRAP)
    try:
        while True:
            msg = consumer.poll(poll_timeout)
            if msg is None:
                continue
            if msg.error():
                if msg.error().code() == KafkaError._PARTITION_EOF:  # noqa: SLF001
                    continue
                raise KafkaException(msg.error())
            try:
                data = json.loads(msg.value().decode("utf-8"))
                if not isinstance(data, dict):
                    raise ValueError("Kafka 메시지는 JSON object 여야 함")
                handler(data)
                consumer.commit(asynchronous=False)
            except Exception:
                log.exception(
                    "handler 실패 topic=%s partition=%s offset=%s — commit 안 함",
                    msg.topic(),
                    msg.partition(),
                    msg.offset(),
                )
    finally:
        consumer.close()
        log.info("consumer closed group=%s", group_id)
