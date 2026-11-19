"""이미지 수집 Flink job — DH/api/image_pipeline/flink_role_a.py (모드 A) 를 Flink 로 이전 (2026-11-19, DH·MS 승인)

흐름 (DH 와 동일):
  aiax.image.ingest (E1a JSON) → 형식 검사(parse_ingest) → mes.casting_image UPSERT (app_mes)
  → 성공한 건만 aiax.image.spark_sync 에 {"casting_id": ..., "op": "upsert"} (키 = casting_id)

DH 와 일부러 다른 점 (승인됨):
  - DB 연결 끊김 등 일시 오류: DH 는 로그만 남기고 다음 메시지로 넘어가 유실 → 여기서는 job 이 재시작해 같은 메시지부터 재시도
  - 형식 오류·없는 casting_id(FK) 등 데이터 오류: DH 와 같이 로그 남기고 건너뜀 (재시도해도 안 되는 건이라 막지 않음)

제출 (jobmanager 컨테이너):
  /opt/flink/bin/flink run -d -py /opt/flink/jobs/image_ingest.py
환경변수 (compose 가 루트 .env + AIAX_DB_HOST 로 넣어 줌): APP_MES_PASSWORD, DATABASE_URL(포트·DB 이름), AIAX_DB_HOST,
  AIAX_KAFKA_BOOTSTRAP, (선택) AIAX_TOPIC_IMAGE_INGEST·AIAX_TOPIC_IMAGE_SPARK_SYNC·AIAX_IMAGE_CG_FLINK·AIAX_MES_DATABASE_URL
"""
from __future__ import annotations

import base64
import json
import logging
import os
import re
from dataclasses import dataclass
from typing import Any
from urllib.parse import quote_plus, urlparse

from pyflink.common import Configuration, Types, WatermarkStrategy
from pyflink.common.serialization import SimpleStringSchema
from pyflink.datastream import MapFunction, RuntimeContext, StreamExecutionEnvironment
from pyflink.datastream.connectors.kafka import KafkaOffsetResetStrategy, KafkaOffsetsInitializer, KafkaSource

log = logging.getLogger("ms.flink.image_ingest")

# ---- 설정 (DH config.py 와 같은 환경변수 이름·기본값. Kafka 주소만 컨테이너 기준) ----
TOPIC_INGEST = os.environ.get("AIAX_TOPIC_IMAGE_INGEST", "aiax.image.ingest")
TOPIC_SPARK_SYNC = os.environ.get("AIAX_TOPIC_IMAGE_SPARK_SYNC", "aiax.image.spark_sync")
CONSUMER_GROUP_FLINK = os.environ.get("AIAX_IMAGE_CG_FLINK", "dh.image.flink_role_a")
KAFKA_BOOTSTRAP = os.environ.get("AIAX_KAFKA_BOOTSTRAP", "kafka:9092")


def mes_database_url() -> str:
    """app_mes 접속 — DH config.mes_database_url 과 같은 규칙. 호스트만 AIAX_DB_HOST 로 (컨테이너에서 127.0.0.1 은 자기 자신)"""
    explicit = os.environ.get("AIAX_MES_DATABASE_URL", "").strip()
    if explicit:
        return explicit
    base = os.environ.get("DATABASE_URL", "").strip()
    pw = os.environ.get("APP_MES_PASSWORD", "")
    if not (base and pw):
        raise RuntimeError("mes DB URL 없음 — AIAX_MES_DATABASE_URL 또는 DATABASE_URL+APP_MES_PASSWORD")
    u = urlparse(base)
    host = os.environ.get("AIAX_DB_HOST") or u.hostname or "127.0.0.1"
    db = (u.path or "/aiax").lstrip("/") or "aiax"
    return f"postgresql://app_mes:{quote_plus(pw)}@{host}:{u.port or 5432}/{db}"


# ---- E1a 계약 (DH payload.py 그대로) ----
_CASTING_ID_RE = re.compile(r"^L\d+_\d{6}_\d{6}_\d+$")   # L라인번호_날짜_시각_생산번호 (2026-11-19 라인 추가, MS)


@dataclass
class ImageIngestPayload:
    casting_id: str
    image_base64: str
    original_uri: str | None = None
    content_type: str = "image/jpeg"


def parse_ingest(data: dict[str, Any]) -> ImageIngestPayload:
    """유입 메시지 검증. 실패 시 ValueError. (DH payload.parse_ingest 와 동일)"""
    cid = str(data.get("casting_id") or "").strip()
    if not cid or not _CASTING_ID_RE.match(cid):
        raise ValueError("casting_id 형식이 올바르지 않습니다 (예: 260804_070411_1)")

    b64 = data.get("image_base64")
    if not b64 or not isinstance(b64, str):
        raise ValueError("image_base64 가 필요합니다 (E1a)")

    # 원상복구 가능 여부만 확인 (전체를 디코드해 메모리 폭탄 방지 — 앞부분+패딩 검사)
    try:
        sample = b64[:64] + ("====" if len(b64) < 64 else "")
        base64.b64decode(sample, validate=False)
    except Exception as e:  # noqa: BLE001
        raise ValueError(f"image_base64 가 Base64가 아닙니다: {e}") from e

    ct = str(data.get("content_type") or "image/jpeg")
    uri = data.get("original_uri")
    uri_s = str(uri).strip() if uri else None
    return ImageIngestPayload(casting_id=cid, image_base64=b64, original_uri=uri_s, content_type=ct)


# mes INSERT 용 SQL (app_mes) — DH payload.UPSERT_MES_SQL 그대로
UPSERT_MES_SQL = """
INSERT INTO mes.casting_image (casting_id, original_uri, content_type, image_base64, updated_at, created_at)
VALUES (%s, %s, %s, %s, now(), now())
ON CONFLICT (casting_id) DO UPDATE SET
    original_uri = EXCLUDED.original_uri,
    content_type = EXCLUDED.content_type,
    image_base64 = EXCLUDED.image_base64,
    updated_at = now()
"""


class IngestToMes(MapFunction):
    """DH flink_role_a.process_ingest — 1건: 검증 → mes UPSERT → spark_sync. 연결은 태스크당 1개 (open/close)"""

    def open(self, runtime_context: RuntimeContext) -> None:
        import psycopg
        from confluent_kafka import Producer

        logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
        self._psycopg = psycopg
        self._conn = psycopg.connect(mes_database_url(), connect_timeout=15)
        # DH kafka_io.make_producer 와 같은 설정
        self._producer = Producer({"bootstrap.servers": KAFKA_BOOTSTRAP, "acks": "all", "linger.ms": 5})
        log.info("이미지 수집 job 시작 topic=%s → %s group=%s", TOPIC_INGEST, TOPIC_SPARK_SYNC, CONSUMER_GROUP_FLINK)

    def close(self) -> None:
        # 재시작·취소 때 커넥션이 남지 않게
        if getattr(self, "_conn", None) is not None:
            self._conn.close()
        if getattr(self, "_producer", None) is not None:
            self._producer.flush(10)

    def map(self, value: str) -> str:
        # 1) 형식 — DH kafka_io.consume_loop 의 JSON 파싱 + parse_ingest. 실패는 로그 후 건너뜀 (DH 와 같음)
        try:
            data = json.loads(value)
            if not isinstance(data, dict):
                raise ValueError("Kafka 메시지는 JSON object 여야 함")
            payload = parse_ingest(data)
        except Exception:
            log.exception("형식 오류 — 건너뜀 value_len=%s", len(value))
            return "skip:format"

        # 2) mes UPSERT — DH db.mes_upsert_image. 데이터 오류(FK 등)는 건너뜀, 그 외(연결 끊김 등)는 예외 → job 재시작·재시도
        errors = self._psycopg.errors
        try:
            self._conn.execute(UPSERT_MES_SQL, (payload.casting_id, payload.original_uri,
                                                payload.content_type, payload.image_base64))
            self._conn.commit()
        except (errors.IntegrityError, errors.DataError):
            self._conn.rollback()
            log.exception("mes 데이터 오류 — 건너뜀 casting_id=%s", payload.casting_id)
            return f"skip:data:{payload.casting_id}"
        log.info("mes UPSERT ok casting_id=%s", payload.casting_id)

        # 3) spark_sync 신호 — DH kafka_io.publish_json (동기 flush, 실패 시 예외 → 재시도. lake UPSERT 는 같은 건 반복해도 결과 동일)
        body = json.dumps({"casting_id": payload.casting_id, "op": "upsert"}, ensure_ascii=False).encode("utf-8")
        err_box: list = []
        self._producer.produce(TOPIC_SPARK_SYNC, value=body, key=payload.casting_id.encode("utf-8"),
                               callback=lambda err, _msg: err_box.append(err) if err is not None else None)
        self._producer.flush(30)
        if err_box:
            raise RuntimeError(f"spark_sync 발행 실패: {err_box[0]}")
        log.info("mode=A done casting_id=%s → %s", payload.casting_id, TOPIC_SPARK_SYNC)
        return f"done:{payload.casting_id}"


def main() -> None:
    # DH flink_role_a 는 모드 A 전용 — 모드 B 면 시작하지 않음
    if (os.environ.get("AIAX_IMAGE_SINK_MODE") or "A").upper() == "B":
        raise RuntimeError("image_ingest 는 모드 A 전용 (AIAX_IMAGE_SINK_MODE=B)")

    conf = Configuration()
    conf.set_string("execution.checkpointing.interval", "10 s")      # 처리 위치 저장 → 재시작 시 이어서
    conf.set_string("restart-strategy.type", "exponential-delay")    # DB 끊김 등 → 5초부터 최대 2분 간격으로 계속 재시도
    conf.set_string("restart-strategy.exponential-delay.initial-backoff", "5 s")
    conf.set_string("restart-strategy.exponential-delay.max-backoff", "2 min")
    env = StreamExecutionEnvironment.get_execution_environment(conf)
    env.set_parallelism(1)   # 같은 casting_id 순서 보장 (메시지 양이 늘면 키 기준 병렬화)

    source = (
        KafkaSource.builder()
        .set_bootstrap_servers(KAFKA_BOOTSTRAP)
        .set_topics(TOPIC_INGEST)
        .set_group_id(CONSUMER_GROUP_FLINK)
        # DH 와 같이 처음 실행이면 처음부터(earliest), 이후는 커밋 위치부터
        .set_starting_offsets(KafkaOffsetsInitializer.committed_offsets(KafkaOffsetResetStrategy.EARLIEST))
        .set_value_only_deserializer(SimpleStringSchema())
        .build()
    )
    (env.from_source(source, WatermarkStrategy.no_watermarks(), "kafka:" + TOPIC_INGEST)
        .map(IngestToMes(), output_type=Types.STRING()).name("ingest→mes→spark_sync")
        .print().name("결과 로그"))
    env.execute("image_ingest (DH flink_role_a 이전)")


if __name__ == "__main__":
    main()
