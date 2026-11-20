"""샷 수집 Flink job — 공정 샷(센서값) 실시간 적재 (2026-11-19, MS)

요청: JH/전달사항/2026-11-19_MS_공정실시간_샷수집_Flink_요청.md
메시지 형식: MS/db/docs/시연 데이터 생성 규칙 (실시간용).pdf 「출력 형식」 (칼럼 23개, 원본 이름 그대로)

흐름:
  aiax.shot.ingest (샷 1건 = JSON 1건) → 형식 검사 → mes.investment_casting INSERT (app_mes)
  - casting_id 는 DB 가 자동 생성 (L라인번호_날짜_시각_생산번호) → 메시지에 있어도 쓰지 않음
  - 같은 샷이 다시 오면(같은 casting_id) 건너뜀 (ON CONFLICT DO NOTHING) → 두 번 쌓이지 않음
  - lake 반영은 mes 트리거(변경 기록) + lake_runner(매일 00:00 KST)가 함
오류 처리 (image_ingest.py 와 같음):
  - 형식 오류·데이터 오류: 로그 남기고 건너뜀 (재시도해도 안 되는 건이라 막지 않음)
  - DB 연결 끊김 등 일시 오류: 예외 → job 재시작, 같은 메시지부터 재시도

제출 (jobmanager 컨테이너):
  /opt/flink/bin/flink run -d -py /opt/flink/jobs/shot_ingest.py
환경변수 (compose 가 루트 .env + AIAX_DB_HOST 로 넣어 줌): APP_MES_PASSWORD, DATABASE_URL(포트·DB 이름), AIAX_DB_HOST,
  AIAX_KAFKA_BOOTSTRAP, (선택) AIAX_TOPIC_SHOT_INGEST·AIAX_SHOT_CG_FLINK·AIAX_MES_DATABASE_URL
"""
from __future__ import annotations

import json
import logging
import os
import re
from datetime import date, datetime
from typing import Any
from urllib.parse import quote_plus, urlparse

from pyflink.common import Configuration, Types, WatermarkStrategy
from pyflink.common.serialization import SimpleStringSchema
from pyflink.datastream import MapFunction, RuntimeContext, StreamExecutionEnvironment
from pyflink.datastream.connectors.kafka import KafkaOffsetResetStrategy, KafkaOffsetsInitializer, KafkaSource

log = logging.getLogger("ms.flink.shot_ingest")

TOPIC_SHOT = os.environ.get("AIAX_TOPIC_SHOT_INGEST", "aiax.shot.ingest")
CONSUMER_GROUP = os.environ.get("AIAX_SHOT_CG_FLINK", "ms.shot.flink")
KAFKA_BOOTSTRAP = os.environ.get("AIAX_KAFKA_BOOTSTRAP", "kafka:9092")

# mes.investment_casting 칼럼 (casting_id 제외, DB 순서). 메시지 키는 대소문자 무시 (facility_CycleTime, PassOrFail 등)
SENSORS = ["mold_temperature", "facility_cycletime", "production_cycletime", "mechanical_strength",
           "molten_capacity", "injection_pressure", "sleeve_temperature",
           "top_temp1", "top_temp2", "top_temp3", "top_temp4",
           "bottom_temp1", "bottom_temp2", "bottom_temp3", "bottom_temp4",
           "biscuit_thickness", "cooling_water_temp"]
COLUMNS = ["line_unit", "production", "timestamp", "date", "production_count", *SENSORS, "passorfail"]
_LINE_RE = re.compile(r"^line_no\d+$")

INSERT_SQL = (
    "INSERT INTO mes.investment_casting (" + ", ".join(f'"{c}"' for c in COLUMNS) + ") "
    "VALUES (" + ", ".join(["%s"] * len(COLUMNS)) + ") "
    "ON CONFLICT (casting_id) DO NOTHING "
    "RETURNING casting_id"
)


def mes_database_url() -> str:
    """app_mes 접속 — image_ingest.py 와 같은 규칙. 호스트만 AIAX_DB_HOST 로 (컨테이너에서 127.0.0.1 은 자기 자신)"""
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


def _int(name: str, v: Any, required: bool = False) -> int | None:
    """정수 값 (88, "88", 88.0 허용). 빈 값은 None, 소수점 아래가 있으면 오류"""
    if v is None or (isinstance(v, str) and v.strip() == ""):
        if required:
            raise ValueError(f"{name} 이(가) 비어 있음")
        return None
    f = float(v)
    if f != int(f):
        raise ValueError(f"{name} 은(는) 정수여야 함: {v}")
    return int(f)


def parse_shot(data: dict[str, Any]) -> list:
    """메시지 1건 → INSERT 값 (COLUMNS 순서). 실패 시 ValueError"""
    d = {str(k).strip().lower(): v for k, v in data.items()}
    line = str(d.get("line_unit") or "").strip()
    if not _LINE_RE.match(line):
        raise ValueError(f"line_unit 형식 오류 (예: line_no1): {line!r}")
    production = str(d.get("production") or "CylinderHead").strip()
    day: date = datetime.strptime(str(d.get("timestamp") or "").strip(), "%Y-%m-%d").date()
    t = datetime.strptime(str(d.get("date") or "").strip(), "%H:%M:%S").time()   # 7:04:11 · 07:04:11 둘 다 허용
    count = _int("production_count", d.get("production_count"), required=True)
    if count < 1:
        raise ValueError(f"production_count 는 1 이상: {count}")
    sensors = [_int(c, d.get(c)) for c in SENSORS]
    pf = _int("passorfail", d.get("passorfail"))
    if pf not in (None, 0, 1):
        raise ValueError(f"PassOrFail 은 0·1 또는 빈 값: {pf}")
    return [line, production, day, t, count, *sensors, pf]


class ShotToMes(MapFunction):
    """1건: 검증 → mes INSERT. 연결은 태스크당 1개 (open/close)"""

    def open(self, runtime_context: RuntimeContext) -> None:
        import psycopg

        logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
        self._psycopg = psycopg
        self._conn = psycopg.connect(mes_database_url(), connect_timeout=15)
        log.info("샷 수집 job 시작 topic=%s group=%s", TOPIC_SHOT, CONSUMER_GROUP)

    def close(self) -> None:
        # 재시작·취소 때 커넥션이 남지 않게
        if getattr(self, "_conn", None) is not None:
            self._conn.close()

    def map(self, value: str) -> str:
        # 1) 형식 — 실패는 로그 후 건너뜀
        try:
            data = json.loads(value)
            if not isinstance(data, dict):
                raise ValueError("Kafka 메시지는 JSON object 여야 함")
            row = parse_shot(data)
        except Exception:
            log.exception("형식 오류 — 건너뜀 value=%s", value[:200])
            return "skip:format"

        # 2) mes INSERT — 데이터 오류는 건너뜀, 그 외(연결 끊김 등)는 예외 → job 재시작·재시도
        errors = self._psycopg.errors
        try:
            got = self._conn.execute(INSERT_SQL, row).fetchone()
            self._conn.commit()
        except (errors.IntegrityError, errors.DataError):
            self._conn.rollback()
            log.exception("mes 데이터 오류 — 건너뜀 line=%s %s %s #%s", row[0], row[2], row[3], row[4])
            return "skip:data"
        if got is None:
            log.info("이미 있는 샷 — 건너뜀 line=%s %s %s #%s", row[0], row[2], row[3], row[4])
            return "skip:duplicate"
        log.info("mes INSERT ok casting_id=%s", got[0])
        return f"done:{got[0]}"


def main() -> None:
    conf = Configuration()
    conf.set_string("execution.checkpointing.interval", "10 s")      # 처리 위치 저장 → 재시작 시 이어서
    conf.set_string("restart-strategy.type", "exponential-delay")    # DB 끊김 등 → 5초부터 최대 2분 간격으로 계속 재시도
    conf.set_string("restart-strategy.exponential-delay.initial-backoff", "5 s")
    conf.set_string("restart-strategy.exponential-delay.max-backoff", "2 min")
    env = StreamExecutionEnvironment.get_execution_environment(conf)
    env.set_parallelism(1)   # 들어온 순서대로 적재 (설비 3개 × 시간당 약 24샷이라 충분)

    source = (
        KafkaSource.builder()
        .set_bootstrap_servers(KAFKA_BOOTSTRAP)
        .set_topics(TOPIC_SHOT)
        .set_group_id(CONSUMER_GROUP)
        # 처음 실행이면 처음부터(earliest), 이후는 커밋 위치부터
        .set_starting_offsets(KafkaOffsetsInitializer.committed_offsets(KafkaOffsetResetStrategy.EARLIEST))
        .set_value_only_deserializer(SimpleStringSchema())
        .build()
    )
    (env.from_source(source, WatermarkStrategy.no_watermarks(), "kafka:" + TOPIC_SHOT)
        .map(ShotToMes(), output_type=Types.STRING()).name("shot→mes")
        .print().name("결과 로그"))
    env.execute("shot_ingest (공정 샷 실시간 적재)")


if __name__ == "__main__":
    main()
