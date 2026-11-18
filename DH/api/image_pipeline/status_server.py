"""1차 상태 API — 표준 라이브러리만 (추가 패키지 승인 전).

실행 (프로젝트 루트 또는 DH 기준):
  uv run python -m DH.api.image_pipeline.status_server
  또는:
  cd DH && python -m api.image_pipeline.status_server

  GET /health
  GET /config
  POST /v1/image/ingest/dry-run   JSON body → E1a 검증 + 모드 A/B 단계 미리보기
"""
from __future__ import annotations

import json
import logging
import sys
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from urllib.parse import urlparse

# `cd DH && python -m api.image_pipeline.status_server` 기준
try:
    from api.image_pipeline import config
    from api.image_pipeline.pipeline import handle_ingest_message
except ImportError:  # 직접 파일 실행 시
    _API_ROOT = Path(__file__).resolve().parents[1]
    if str(_API_ROOT) not in sys.path:
        sys.path.insert(0, str(_API_ROOT))
    from image_pipeline import config  # noqa: E402
    from image_pipeline.pipeline import handle_ingest_message  # noqa: E402

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

    def do_GET(self) -> None:  # noqa: N802
        path = urlparse(self.path).path
        if path == "/health":
            self._json(200, {"ok": True, "service": "dh.image_pipeline", "phase": 1})
            return
        if path == "/config":
            self._json(200, config.public_config())
            return
        self._json(404, {"ok": False, "error": "not_found"})

    def do_POST(self) -> None:  # noqa: N802
        path = urlparse(self.path).path
        if path != "/v1/image/ingest/dry-run":
            self._json(404, {"ok": False, "error": "not_found"})
            return
        n = int(self.headers.get("Content-Length") or 0)
        try:
            data = json.loads(self.rfile.read(n).decode("utf-8") or "{}")
            result = handle_ingest_message(data)
            self._json(200, result)
        except ValueError as e:
            self._json(400, {"ok": False, "error": str(e)})
        except Exception as e:  # noqa: BLE001
            log.exception("dry-run 실패")
            self._json(500, {"ok": False, "error": str(e)})


def main() -> None:
    httpd = HTTPServer((HOST, PORT), Handler)
    log.info("image_pipeline status listening http://%s:%s (phase=1)", HOST, PORT)
    httpd.serve_forever()


if __name__ == "__main__":
    main()
