"""Al 시세 조회 HTTP (stdlib). GET /health, GET /prices"""
from __future__ import annotations

import json
import logging
import os
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import parse_qs, urlparse

from . import db
from .env_load import load_root_env

log = logging.getLogger("dh.aluminum_price.server")

HOST = "127.0.0.1"
DEFAULT_PORT = 8766


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt: str, *args) -> None:  # noqa: A003
        log.info("%s - " + fmt, self.address_string(), *args)

    def _json(self, code: int, body: dict | list) -> None:
        raw = json.dumps(body, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def do_OPTIONS(self) -> None:  # noqa: N802
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self) -> None:  # noqa: N802
        parsed = urlparse(self.path)
        path = parsed.path
        if path == "/health":
            self._json(200, {"ok": True, "service": "dh.aluminum_price"})
            return
        if path in ("/prices", "/api/al-price/prices"):
            qs = parse_qs(parsed.query)
            try:
                limit = int((qs.get("limit") or ["500"])[0])
            except ValueError:
                limit = 500
            limit = max(1, min(limit, 5000))
            try:
                rows = db.list_prices(limit=limit)
                self._json(200, {"ok": True, "rows": rows, "count": len(rows)})
            except Exception as e:
                log.exception("prices 조회 실패")
                self._json(500, {"ok": False, "error": str(e)})
            return
        self._json(404, {"ok": False, "error": "not_found"})


def serve(*, port: int | None = None) -> None:
    load_root_env()
    p = port or int(os.environ.get("AIAX_AL_PRICE_PORT", str(DEFAULT_PORT)))
    httpd = HTTPServer((HOST, p), Handler)
    log.info("aluminum_price 조회 서버 http://%s:%s", HOST, p)
    httpd.serve_forever()
