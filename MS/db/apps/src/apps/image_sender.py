r"""양품 샷 이미지 전송기 — mes 에 새로 들어온 양품 샷에 사진을 붙여 Kafka 로 보냄 (2026-11-20, MS)

DH image_pipeline.producer 와 같은 메시지(E1a)·토픽. 차이: 한 장씩 손으로 보내는 대신
mes 를 주기적으로 확인해 「양품(passorfail = 0)인데 이미지 없는 샷」을 찾아 자동으로 보냄.

흐름: mes.investment_casting (새 양품 샷) → 이 프로그램 → Kafka aiax.image.ingest
      → Flink image_ingest (MS/db/flink/jobs/image_ingest.py) → mes.casting_image

사진: --image-dir 아래 ok_front(양품 사진) / def_front(불량 사진), 불량 사진 비율 --defect-image-rate (기본 5%)
      같은 사진 재사용 허용. 메시지의 image_label(ok / defect) = 붙인 사진의 정답 (Flink 가 서버 API 로 같이 보냄 → mes.casting_image.image_label)

실행 (MS/db/apps 에서)
  uv run python -m apps.image_sender                    # 지금부터 들어오는 샷만, 10초마다 확인
  uv run python -m apps.image_sender --dry-run --once   # 보낼 대상만 한 번 출력 (Kafka 안 씀)
  uv run python -m apps.image_sender --since "2026-11-19 00:00"   # 지난 샷도 채우기

설정은 루트 .env: DATABASE_URL(mes 읽기), AIAX_KAFKA_BOOTSTRAP_HOST(기본 localhost:9094),
                  AIAX_TOPIC_IMAGE_INGEST(기본 aiax.image.ingest)
DB·Kafka 가 끊겨도 꺼지지 않고 다음 확인 때 다시 시도. 끊긴 동안 들어온 샷은 다시 연결되면 채움.
"""
from __future__ import annotations

import argparse
import base64
import json
import os
import random
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path

try:
    from zoneinfo import ZoneInfo
    KST = ZoneInfo("Asia/Seoul")
except Exception:  # Windows 에 tzdata 가 없을 때 — 한국은 서머타임이 없어 UTC+9 고정
    KST = timezone(timedelta(hours=9), "KST")

ROOT_ENV = Path(__file__).resolve().parents[5] / ".env"
IMAGE_DIR = r"D:\AIAX_data\casting_images"
RESEND_AFTER = 300   # 보냈는데 이 시간(초) 지나도 DB 에 없으면 다시 보냄 (Flink 중단 등)

# 양품 + 이미지 없음 + 샷 시각이 since ~ 지금(KST) 사이. 미래 시각 샷(미리 넣어 둔 데이터)은 건너뜀
TARGET_SQL = """
SELECT c.casting_id
FROM mes.investment_casting c
WHERE c.passorfail = 0
  AND (c."timestamp" + c.date) >= %(since)s
  AND (c."timestamp" + c.date) <= (now() AT TIME ZONE 'Asia/Seoul')
  AND NOT EXISTS (SELECT 1 FROM mes.casting_image i WHERE i.casting_id = c.casting_id)
ORDER BY c."timestamp", c.date, c.production_count
LIMIT %(limit)s
"""


def log(msg: str) -> None:
    print(f"[image_sender {datetime.now(KST):%Y-%m-%d %H:%M:%S}] {msg}", flush=True)


def load_env() -> None:
    if ROOT_ENV.exists():
        for line in ROOT_ENV.read_text(encoding="utf-8").splitlines():
            if line.strip().startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip().strip('"'))


class Images:
    """붙일 사진 고르기 (불량 사진 비율대로)"""

    def __init__(self, root: str, defect_rate: float, rng: random.Random):
        self.ok = sorted(Path(root, "ok_front").glob("*.jp*g"))
        self.bad = sorted(Path(root, "def_front").glob("*.jp*g"))
        if not self.ok or not self.bad:
            raise SystemExit(f"[image_sender] 사진 폴더가 비어 있음: {root} (ok_front·def_front)")
        self.rate, self.rng = defect_rate, rng

    def pick(self) -> tuple[Path, str]:
        if self.rng.random() < self.rate:
            return self.rng.choice(self.bad), "defect"
        return self.rng.choice(self.ok), "ok"


def message(cid: str, img: Path, label: str) -> dict:
    """E1a 메시지 (DH payload / Flink image_ingest 형식) + image_label"""
    return {
        "casting_id": cid,
        "content_type": "image/jpeg",
        "original_uri": f"{img.parent.name}/{img.name}",   # 기록만
        "image_label": label,
        "image_base64": base64.b64encode(img.read_bytes()).decode("ascii"),
    }


class Sender:
    def __init__(self, args: argparse.Namespace):
        self.args = args
        self.images = Images(args.image_dir, args.defect_image_rate, random.Random(args.seed))
        self.topic = os.environ.get("AIAX_TOPIC_IMAGE_INGEST", "aiax.image.ingest")
        self.bootstrap = os.environ.get("AIAX_KAFKA_BOOTSTRAP_HOST", "localhost:9094")
        self.url = os.environ.get("DATABASE_URL")
        if not self.url:
            raise SystemExit("[image_sender] 루트 .env 에 DATABASE_URL 이 없습니다.")
        self.conn = None
        self.prod = None
        self.sent: dict[str, float] = {}   # casting_id → 보낸 시각 (중복 전송 방지)
        self.total = {"ok": 0, "defect": 0}

    def db(self):
        import psycopg
        if self.conn is None or self.conn.closed:
            self.conn = psycopg.connect(self.url, connect_timeout=15, autocommit=True)
        return self.conn

    def producer(self):
        if self.prod is None:
            from confluent_kafka import Producer
            self.prod = Producer({"bootstrap.servers": self.bootstrap, "acks": "all", "linger.ms": 5})
        return self.prod

    def targets(self) -> list[str]:
        rows = self.db().execute(TARGET_SQL, {"since": self.args.since, "limit": self.args.batch}).fetchall()
        now = time.monotonic()
        self.sent = {k: t for k, t in self.sent.items() if now - t < RESEND_AFTER}
        return [r[0] for r in rows if r[0] not in self.sent]

    def send(self, cid: str) -> None:
        img, label = self.images.pick()
        if self.args.dry_run:
            log(f"(dry-run) {cid} ← {label} {img.parent.name}/{img.name}")
            self.sent[cid] = time.monotonic()
            return
        err: list = []
        self.producer().produce(self.topic, key=cid.encode(),
                                value=json.dumps(message(cid, img, label), ensure_ascii=False).encode("utf-8"),
                                callback=lambda e, _m: err.append(e) if e else None)
        self.producer().flush(30)
        if err:
            raise RuntimeError(f"Kafka 전송 실패: {err[0]}")
        self.sent[cid] = time.monotonic()
        self.total[label] += 1
        log(f"{cid} ← {label} {img.parent.name}/{img.name}")

    def scan(self) -> int:
        try:
            ids = self.targets()
        except Exception as e:   # DB 끊김 — 다음 확인 때 다시 연결
            log(f"DB 조회 실패, {self.args.interval}초 뒤 다시: {e}")
            try:
                if self.conn is not None:
                    self.conn.close()
            except Exception:
                pass
            self.conn = None
            return 0
        n = 0
        for cid in ids:
            try:
                self.send(cid)
                n += 1
            except Exception as e:   # Kafka 끊김 — 남은 샷은 다음 확인 때
                log(f"전송 실패, {self.args.interval}초 뒤 다시: {e}")
                break
        return n

    def run(self) -> None:
        log(f"시작 — 토픽={self.topic} Kafka={self.bootstrap} 확인 간격={self.args.interval}초 "
            f"불량 사진 비율={self.args.defect_image_rate} 대상=샷 시각 {self.args.since:%Y-%m-%d %H:%M} 이후"
            + (" (dry-run: 보내지 않음)" if self.args.dry_run else ""))
        try:
            while True:
                n = self.scan()
                if self.args.once:
                    break
                # 밀린 샷이 한 번에 다 못 담겼으면 바로 다음 묶음
                if n < self.args.batch:
                    time.sleep(self.args.interval)
        except KeyboardInterrupt:
            log("중지 (Ctrl+C)")
        finally:
            if self.prod is not None:
                self.prod.flush(10)
            log(f"보낸 사진 양품 {self.total['ok']} · 불량 {self.total['defect']}")


def main() -> None:
    load_env()
    ap = argparse.ArgumentParser(description="양품 샷 이미지 전송기 (mes → Kafka aiax.image.ingest)")
    ap.add_argument("--interval", type=float, default=10, help="새 샷 확인 간격(초)")
    ap.add_argument("--defect-image-rate", type=float, default=0.05, help="불량 사진 비율")
    ap.add_argument("--image-dir", default=IMAGE_DIR)
    ap.add_argument("--since", help='이 시각(KST) 이후 샷부터, 예 "2026-11-19 00:00". 없으면 시작 5분 전부터')
    ap.add_argument("--batch", type=int, default=200, help="한 번에 보낼 최대 샷 수")
    ap.add_argument("--dry-run", action="store_true", help="보낼 대상만 출력, Kafka 안 씀")
    ap.add_argument("--once", action="store_true", help="한 번만 확인하고 끝")
    ap.add_argument("--seed", type=int)
    args = ap.parse_args()
    if not 0 <= args.defect_image_rate <= 1:
        ap.error("--defect-image-rate 는 0~1")
    args.since = (datetime.strptime(args.since, "%Y-%m-%d %H:%M") if args.since
                  else datetime.now(KST).replace(tzinfo=None) - timedelta(minutes=5))
    Sender(args).run()


if __name__ == "__main__":
    main()
