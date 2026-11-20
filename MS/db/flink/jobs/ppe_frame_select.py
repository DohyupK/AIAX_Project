"""보호구 판정 사진 고르기 Flink job (2026-11-20, MS)

흐름:
  게이트 프로그램(MS/ppe_gate/gate_judge.py) → Kafka aiax.ppe.frame
    {"type":"frame",  "session", "gate", "count", "score", "ts", "image_base64"}   판정 3초 동안 화면들
    {"type":"result", "session", "gate", "ppe_check_idx", "result", "who", "ts"}    판정 끝 (판정 번호)
  → 세션(태깅 1번)별로 중요한 장면 1장을 고름
      1) 보호구 5개(착용·미착용 박스 아무거나)가 다 잡힌 화면 우선 — 잡힌 수(count)가 많은 화면
      2) 같으면 신뢰도 합(score)이 높은 화면
  → 결과가 오면 그 판정 번호로 서버 사진 받기 API POST /api/images/ppe/<판정번호>
      → /root/images/ppe/<판정번호>.jpg + ai.ppe_check_image (init 29)
  판정 번호가 없으면(게이트를 --no-db 로 돌림) 고른 결과만 로그. 결과 뒤에 늦게 온 화면은 버림

제출 (jobmanager 컨테이너):
  /opt/flink/bin/flink run -d -py /opt/flink/jobs/ppe_frame_select.py
환경변수 (compose 가 루트 .env 를 넣어 줌): IMAGE_API_KEY, (선택) AIAX_IMAGE_API_BASE(기본 https://gknushift.freemyip.com/api/images),
  AIAX_KAFKA_BOOTSTRAP(kafka:9092), AIAX_TOPIC_PPE_FRAME(aiax.ppe.frame)
"""
from __future__ import annotations

import json
import logging
import os
import time

from pyflink.common import Configuration, Types, WatermarkStrategy
from pyflink.common.serialization import SimpleStringSchema
from pyflink.datastream import MapFunction, RuntimeContext, StreamExecutionEnvironment
from pyflink.datastream.connectors.kafka import KafkaOffsetResetStrategy, KafkaOffsetsInitializer, KafkaSource

log = logging.getLogger("ms.flink.ppe_frame_select")

TOPIC = os.environ.get("AIAX_TOPIC_PPE_FRAME", "aiax.ppe.frame")
KAFKA_BOOTSTRAP = os.environ.get("AIAX_KAFKA_BOOTSTRAP", "kafka:9092")
GROUP = os.environ.get("AIAX_PPE_FRAME_CG", "ms.ppe.frame_select")
API_BASE = os.environ.get("AIAX_IMAGE_API_BASE", "https://gknushift.freemyip.com/api/images").rstrip("/")
API_KEY = os.environ.get("IMAGE_API_KEY", "").strip()
SESSION_TTL = 300   # 결과가 안 오는 세션(게이트 강제 종료 등)은 5분 뒤 버림


class ApiDataError(Exception):
    """API 가 400 으로 거절 — 다시 보내도 안 되는 건 (건너뜀)"""


def better(a: dict | None, b: dict) -> bool:
    """b 가 a 보다 중요한 장면인가: 잡힌 보호구 수 → 신뢰도 합 → 먼저 온 화면"""
    if a is None:
        return True
    return (int(b.get("count", 0)), float(b.get("score", 0))) > (int(a.get("count", 0)), float(a.get("score", 0)))


class Selector:
    """세션별 최고 화면 1장만 들고 있음 (메모리). Flink 와 분리해 단독 시험 가능"""

    def __init__(self):
        self.best: dict[str, dict] = {}
        self.done: dict[str, float] = {}   # 결과 처리한 세션 (늦게 온 화면 버리기용)

    def add(self, msg: dict, now: float) -> dict | None:
        """메시지 1개 처리. 결과 메시지면 (고른 화면 + 판정 정보) 반환"""
        s = str(msg.get("session") or "")
        if not s:
            return None
        self._cleanup(now)
        if msg.get("type") == "frame":
            if s in self.done:
                return None                  # 결과 뒤 늦게 온 화면
            if msg.get("image_base64") and better(self.best.get(s), msg):
                self.best[s] = {**msg, "_seen": now}
            elif s in self.best:
                self.best[s]["_seen"] = now
            return None
        if msg.get("type") == "result":
            self.done[s] = now
            pick = self.best.pop(s, None)
            return {"result": msg, "frame": pick}
        return None

    def _cleanup(self, now: float) -> None:
        for s in [k for k, v in self.best.items() if now - v["_seen"] > SESSION_TTL]:
            del self.best[s]
        for s in [k for k, t in self.done.items() if now - t > SESSION_TTL]:
            del self.done[s]


def post_image(check_idx: int, frame: dict, base: str = "", key: str = "", timeout: float = 30) -> int:
    import urllib.error
    import urllib.request

    body = json.dumps({"image_base64": frame["image_base64"], "detected_count": int(frame.get("count", 0)),
                       "score": float(frame.get("score", 0))}).encode("utf-8")
    req = urllib.request.Request(f"{base or API_BASE}/ppe/{check_idx}", data=body, method="POST",
                                 headers={"Content-Type": "application/json", "X-API-Key": key or API_KEY})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as res:
            return res.status
    except urllib.error.HTTPError as e:
        detail = e.read(300).decode("utf-8", "replace")
        if e.code in (400, 409, 422):
            raise ApiDataError(f"HTTP {e.code}: {detail}") from e
        raise RuntimeError(f"사진 받기 API 오류 HTTP {e.code}: {detail}") from e


class SelectAndSave(MapFunction):
    def open(self, runtime_context: RuntimeContext) -> None:
        logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
        if not API_KEY:
            raise RuntimeError("IMAGE_API_KEY 가 비어 있음 (루트 .env)")
        self.sel = Selector()
        log.info("보호구 판정 사진 job 시작 topic=%s → %s/ppe/<판정번호>", TOPIC, API_BASE)

    def map(self, value: str) -> str:
        try:
            msg = json.loads(value)
        except Exception:
            log.exception("JSON 아님 — 건너뜀")
            return "skip:format"
        out = self.sel.add(msg, time.time())
        if out is None:
            return "frame"
        res, frame = out["result"], out["frame"]
        idx, who = res.get("ppe_check_idx"), res.get("who")
        if frame is None:
            log.warning("화면 없음 — 사진 없이 끝 session=%s check=%s", res.get("session"), idx)
            return f"noframe:{idx}"
        if not idx:
            log.info("판정 번호 없음(--no-db) — 고른 화면: 보호구 %s개, 신뢰도 합 %s (%s)", frame.get("count"), frame.get("score"), who)
            return "nodb"
        try:
            status = post_image(int(idx), frame)
        except ApiDataError:
            log.exception("API 데이터 오류 — 건너뜀 check=%s", idx)
            return f"skip:data:{idx}"
        log.info("판정 사진 저장 HTTP %s check=%s 보호구 %s개 신뢰도 합 %s (%s %s)",
                 status, idx, frame.get("count"), frame.get("score"), who, res.get("result"))
        return f"saved:{idx}"


def main() -> None:
    conf = Configuration()
    conf.set_string("execution.checkpointing.interval", "10 s")
    conf.set_string("restart-strategy.type", "exponential-delay")
    conf.set_string("restart-strategy.exponential-delay.initial-backoff", "5 s")
    conf.set_string("restart-strategy.exponential-delay.max-backoff", "2 min")
    env = StreamExecutionEnvironment.get_execution_environment(conf)
    env.set_parallelism(1)   # 세션별 화면이 한곳에 모여야 함

    source = (
        KafkaSource.builder()
        .set_bootstrap_servers(KAFKA_BOOTSTRAP)
        .set_topics(TOPIC)
        .set_group_id(GROUP)
        .set_starting_offsets(KafkaOffsetsInitializer.committed_offsets(KafkaOffsetResetStrategy.LATEST))
        .set_property("max.partition.fetch.bytes", "4194304")
        .set_value_only_deserializer(SimpleStringSchema())
        .build()
    )
    (env.from_source(source, WatermarkStrategy.no_watermarks(), "kafka:" + TOPIC)
        .map(SelectAndSave(), output_type=Types.STRING()).name("세션별 중요한 장면 → 서버")
        .filter(lambda r: r != "frame").print().name("결과 로그"))
    env.execute("ppe_frame_select")


if __name__ == "__main__":
    main()
