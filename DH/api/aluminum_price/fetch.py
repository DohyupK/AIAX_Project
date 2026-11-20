"""협회 LME시세 페이지 HTTP GET (stdlib urllib)."""
from __future__ import annotations

import logging
import time
import urllib.error
import urllib.request

from .parse import AlRow, parse_lme_al_html

log = logging.getLogger("dh.aluminum_price.fetch")

BASE_URL = "https://www.nonferrous.or.kr/stats/?act=sub3&page={page}"
USER_AGENT = "AIAX-DH-aluminum_price/0.1 (+internal; daily LME Al snapshot)"
TIMEOUT_SEC = 45
MAX_RETRIES = 3
RETRY_SLEEP_SEC = 2.0


def fetch_page_html(page: int) -> str:
    url = BASE_URL.format(page=page)
    last_err: Exception | None = None
    for attempt in range(1, MAX_RETRIES + 1):
        req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
        try:
            with urllib.request.urlopen(req, timeout=TIMEOUT_SEC) as resp:
                raw = resp.read()
                charset = resp.headers.get_content_charset() or "utf-8"
                return raw.decode(charset, errors="replace")
        except (urllib.error.URLError, TimeoutError, OSError) as e:
            last_err = e
            log.warning("page=%s attempt=%s 실패: %s", page, attempt, e)
            if attempt < MAX_RETRIES:
                time.sleep(RETRY_SLEEP_SEC * attempt)
    raise RuntimeError(f"page={page} GET 실패: {last_err}") from last_err


def fetch_al_rows(page: int) -> list[AlRow]:
    html = fetch_page_html(page)
    rows = parse_lme_al_html(html)
    log.info("page=%s rows=%s", page, len(rows))
    return rows
