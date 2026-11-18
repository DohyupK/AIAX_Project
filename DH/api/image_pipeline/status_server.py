"""이미지 파이프라인 상태 API (2차).

실행 (DH/api):
  uv run python -m image_pipeline.status_server

  GET  /health
  GET  /config
  POST /v1/image/ingest/dry-run   — 검증·단계 미리보기 (DB/Kafka 쓰기 없음)
  POST /v1/image/ingest           — Kafka ingest 토픽에 publish (소비자 필요)
"""
from __future__ import annotations

import json
import logging
import sys
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from urllib.parse import urlparse

from .env_load import load_root_env

load_root_env()

try:
    from . import config
    from .pipeline import handle_ingest_message
    from .producer import publish_ingest
except ImportError:  # 직접 파일 실행 시
    _API_ROOT = Path(__file__).resolve().parents[1]
    if str(_API_ROOT) not in sys.path:
        sys.path.insert(0, str(_API_ROOT))
    from image_pipeline import config  # noqa: E402
    from image_pipeline.pipeline import handle_ingest_message  # noqa: E402
    from image_pipeline.producer import publish_ingest  # noqa: E402

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
log = logging.getLogger("dh.image_pipeline.status")

HOST = "127.0.0.1"
PORT = int(__import__("os").environ.get("AIAX_IMAGE_PIPELINE_PORT", "8765"))


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt: str, *args) -> None:  # noqa: A003
        log.info("%s - " + fmt, self.address_string(), *args)

    def _json(self, code: int, body: dict) -> None:
        raw = json.dumps(body, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def _read_json(self) -> dict:
        n = int(self.headers.get("Content-Length") or 0)
        return json.loads(self.rfile.read(n).decode("utf-8") or "{}")

    def do_GET(self) -> None:  # noqa: N802
        path = urlparse(self.path).path
        if path == "/health":
            cfg = config.public_config()
            self._json(
                200,
                {
                    "ok": True,
                    "service": "dh.image_pipeline",
                    "phase": 2,
                    "kafka_bootstrap": cfg["kafka_bootstrap"],
                    "mes_configured": cfg["mes_database_url_configured"],
                    "spark_configured": cfg["spark_database_url_configured"],
                },
            )
            return
        if path == "/config":
            self._json(200, config.public_config())
            return
        self._json(404, {"ok": False, "error": "not_found"})

    def do_POST(self) -> None:  # noqa: N802
        path = urlparse(self.path).path
        try:
            data = self._read_json()
            if path == "/v1/image/ingest/dry-run":
                result = handle_ingest_message(data, dry_run=True)
                self._json(200, result)
                return
            if path == "/v1/image/ingest":
                # Kafka publish only — Flink job(MS/db/flink/jobs/image_ingest.py) / lake_sync_consumer 가 후속 처리
                result = publish_ingest(data)
                self._json(200, result)
                return
            self._json(404, {"ok": False, "error": "not_found"})
        except ValueError as e:
            self._json(400, {"ok": False, "error": str(e)})
        except Exception as e:  # noqa: BLE001
            log.exception("요청 실패 path=%s", path)
            self._json(500, {"ok": False, "error": str(e)})


def main() -> None:
    httpd = HTTPServer((HOST, PORT), Handler)
    log.info("image_pipeline status listening http://%s:%s (phase=2)", HOST, PORT)
    httpd.serve_forever()


if __name__ == "__main__":
    main()
