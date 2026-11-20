"""슬랙 API 클라이언트 — 토큰·채널은 루트 .env 만 (AGENTS.md 5항)"""
from __future__ import annotations

import logging
import os
from pathlib import Path
from typing import Any

from slack_sdk import WebClient
from slack_sdk.errors import SlackApiError

log = logging.getLogger("jh.slack")
ROOT_ENV = Path(__file__).resolve().parents[3] / ".env"
# chat.postMessage text 권장 상한에 여유를 둔 청크
CHUNK = 3500


def _env(key: str) -> str:
    if os.environ.get(key):
        return os.environ[key].strip()
    if ROOT_ENV.exists():
        for line in ROOT_ENV.read_text(encoding="utf-8").splitlines():
            if line.strip().startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            if k.strip() == key:
                return v.strip().strip('"')
    raise RuntimeError(f"루트 .env 에 {key} 가 없습니다.")


def require_slack() -> tuple[WebClient, str]:
    token = _env("SLACK_BOT_TOKEN")
    channel = _env("SLACK_REPORT_CHANNEL_ID")
    if not token or not channel:
        raise RuntimeError("루트 .env 의 SLACK_BOT_TOKEN / SLACK_REPORT_CHANNEL_ID 를 채워 주세요.")
    return WebClient(token=token), channel


def _chunks(text: str, size: int = CHUNK) -> list[str]:
    if len(text) <= size:
        return [text]
    out: list[str] = []
    rest = text
    while rest:
        if len(rest) <= size:
            out.append(rest)
            break
        cut = rest.rfind("\n", 0, size)
        if cut < size // 2:
            cut = size
        out.append(rest[:cut])
        rest = rest[cut:].lstrip("\n")
    return out


def post_report(client: WebClient, channel: str, title: str, body: str) -> dict[str, Any]:
    """제목 메시지 + 본문(길면 스레드로 이어 붙임). 반환: {ts, channel, permalink?}"""
    parts = _chunks(f"*{title}*\n\n{body}")
    first = client.chat_postMessage(channel=channel, text=parts[0], mrkdwn=True)
    ts = first["ts"]
    ch = first["channel"]
    for part in parts[1:]:
        client.chat_postMessage(channel=ch, text=part, thread_ts=ts, mrkdwn=True)
    permalink = ""
    try:
        pl = client.chat_getPermalink(channel=ch, message_ts=ts)
        permalink = pl.get("permalink") or ""
    except SlackApiError:
        log.warning("슬랙 permalink 조회 실패 channel=%s ts=%s", ch, ts)
    log.info("슬랙 리포트 게시 title=%s channel=%s ts=%s parts=%s", title, ch, ts, len(parts))
    return {"ts": ts, "channel": ch, "permalink": permalink, "parts": len(parts)}


def slack_http_error(exc: SlackApiError) -> str:
    err = ""
    if exc.response is not None:
        err = exc.response.get("error") or str(exc.response.data)
    return f"Slack API 오류: {err or exc}"
