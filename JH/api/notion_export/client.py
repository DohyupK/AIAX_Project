"""노션 API 클라이언트 — 토큰·부모 페이지는 루트 .env 만 (AGENTS.md 5항)"""
from __future__ import annotations

import logging
import os
from pathlib import Path
from typing import Any

from notion_client import Client
from notion_client.errors import APIResponseError

log = logging.getLogger("jh.notion")
ROOT_ENV = Path(__file__).resolve().parents[3] / ".env"  # JH/api/notion_export → 프로젝트 루트
CHUNK = 100  # Notion children append 한 번에 최대 100블록


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


def require_notion(parent_key: str) -> tuple[Client, str]:
    """(클라이언트, 부모 페이지 ID). 토큰·부모 ID 없으면 RuntimeError."""
    token = _env("NOTION_TOKEN")
    parent = _env(parent_key)
    if not token or not parent:
        raise RuntimeError(f"루트 .env 의 NOTION_TOKEN / {parent_key} 를 채워 주세요.")
    return Client(auth=token), parent


def _title_of(block: dict[str, Any]) -> str | None:
    if block.get("type") != "child_page":
        return None
    return block.get("child_page", {}).get("title")


def find_child_page(notion: Client, parent_id: str, title: str) -> str | None:
    """부모 아래 같은 제목의 자식 페이지 ID (없으면 None)"""
    cursor = None
    while True:
        resp = notion.blocks.children.list(block_id=parent_id, start_cursor=cursor)
        for b in resp.get("results", []):
            if _title_of(b) == title:
                return b["id"]
        if not resp.get("has_more"):
            break
        cursor = resp.get("next_cursor")
    return None


def _clear_children(notion: Client, page_id: str) -> None:
    """페이지 본문 블록만 삭제 (하위 자식 페이지는 유지)"""
    cursor = None
    ids: list[str] = []
    while True:
        resp = notion.blocks.children.list(block_id=page_id, start_cursor=cursor)
        for b in resp.get("results", []):
            if b.get("type") != "child_page":
                ids.append(b["id"])
        if not resp.get("has_more"):
            break
        cursor = resp.get("next_cursor")
    for bid in ids:
        notion.blocks.delete(bid)


def _append_chunks(notion: Client, page_id: str, children: list[dict[str, Any]]) -> None:
    for i in range(0, len(children), CHUNK):
        notion.blocks.children.append(block_id=page_id, children=children[i : i + CHUNK])


def upsert_page(
    notion: Client,
    parent_id: str,
    title: str,
    children: list[dict[str, Any]],
) -> dict[str, Any]:
    """같은 제목 페이지가 있으면 본문만 갈아끼우고, 없으면 새로 만듦. 반환: {page_id, url, created}"""
    existing = find_child_page(notion, parent_id, title)
    if existing:
        _clear_children(notion, existing)
        _append_chunks(notion, existing, children)
        page = notion.pages.retrieve(existing)
        log.info("노션 페이지 갱신 title=%s id=%s", title, existing)
        return {"page_id": existing, "url": page.get("url", ""), "created": False}

    # 생성 시 children 도 100개 제한 → 먼저 제목만 만들고 본문 append
    page = notion.pages.create(
        parent={"page_id": parent_id},
        properties={"title": {"title": [{"type": "text", "text": {"content": title}}]}},
        children=children[:CHUNK],
    )
    rest = children[CHUNK:]
    if rest:
        _append_chunks(notion, page["id"], rest)
    log.info("노션 페이지 생성 title=%s id=%s", title, page["id"])
    return {"page_id": page["id"], "url": page.get("url", ""), "created": True}


def notion_http_error(exc: APIResponseError) -> str:
    """사용자용 짧은 메시지 (토큰 값은 넣지 않음)"""
    return f"Notion API 오류 (HTTP {exc.status}): {exc.message}"
