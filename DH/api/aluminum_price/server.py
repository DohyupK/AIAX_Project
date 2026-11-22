"""Al 시세 조회 HTTP. GET /health, /prices, /prices/meta, /prices/csv"""
from __future__ import annotations

import json
import logging
import os
from datetime import date
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import parse_qs, urlparse

from . import db
from .env_load import load_root_env

log = logging.getLogger("dh.aluminum_price.server")

HOST = "127.0.0.1"
DEFAULT_PORT = 8766


def _parse_iso_date(s: str | None) -> date | None:
    if not s:
        return None
    try:
        return date.fromisoformat(s.strip())
    except ValueError:
        return None


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
        path = parsed.path.rstrip("/") or "/"
        qs = parse_qs(parsed.query)

        if path == "/health":
            self._json(200, {"ok": True, "service": "dh.aluminum_price"})
            return

        if path in ("/prices/meta",):
            try:
                meta = db.price_meta()
                self._json(200, {"ok": True, **meta})
            except Exception as e:
                log.exception("meta 실패")
                self._json(500, {"ok": False, "error": str(e)})
            return

        if path in ("/prices/csv",):
            try:
                self.send_response(200)
                self.send_header("Content-Type", "text/csv; charset=utf-8")
                self.send_header(
                    "Content-Disposition",
                    'attachment; filename="aluminum_price_all.csv"',
                )
                self.send_header("Access-Control-Allow-Origin", "*")
                self.end_headers()
                for line in db.iter_all_csv_lines():
                    self.wfile.write(line.encode("utf-8"))
            except Exception as e:
                log.exception("csv 실패")
                if not self.wfile.closed:
                    self._json(500, {"ok": False, "error": str(e)})
            return

        if path in ("/prices", "/api/al-price/prices"):
            date_from = _parse_iso_date((qs.get("from") or [None])[0])
            date_to = _parse_iso_date((qs.get("to") or [None])[0])
            try:
                limit = int((qs.get("limit") or [str(db.RANGE_ROW_CAP)])[0])
            except ValueError:
                limit = db.RANGE_ROW_CAP
            try:
                if date_from and date_to:
                    rows = db.list_prices_range(
                        date_from=date_from, date_to=date_to, limit=limit
                    )
                else:
                    limit = max(1, min(limit, 5000))
                    rows = db.list_prices(limit=limit)
                self._json(
                    200,
                    {
                        "ok": True,
                        "rows": rows,
                        "count": len(rows),
                        "from": date_from.isoformat() if date_from else None,
                        "to": date_to.isoformat() if date_to else None,
                    },
                )
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
