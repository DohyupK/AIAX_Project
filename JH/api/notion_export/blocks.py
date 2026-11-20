"""노션 블록 헬퍼 — heading / callout / paragraph / table / bulleted_list"""
from __future__ import annotations

from typing import Any


def _rt(text: str, bold: bool = False) -> list[dict[str, Any]]:
    """rich_text 한 덩어리 (Notion 2000자 제한 → 잘라 냄)"""
    content = (text or "")[:2000]
    ann: dict[str, Any] = {"bold": True} if bold else {}
    item: dict[str, Any] = {"type": "text", "text": {"content": content}}
    if ann:
        item["annotations"] = ann
    return [item]


def heading2(text: str) -> dict[str, Any]:
    return {"object": "block", "type": "heading_2", "heading_2": {"rich_text": _rt(text)}}


def heading3(text: str) -> dict[str, Any]:
    return {"object": "block", "type": "heading_3", "heading_3": {"rich_text": _rt(text)}}


def paragraph(text: str, bold: bool = False) -> dict[str, Any]:
    return {"object": "block", "type": "paragraph", "paragraph": {"rich_text": _rt(text, bold=bold)}}


def callout(text: str, emoji: str = "📌") -> dict[str, Any]:
    return {
        "object": "block",
        "type": "callout",
        "callout": {
            "rich_text": _rt(text),
            "icon": {"type": "emoji", "emoji": emoji},
        },
    }


def bullet(text: str) -> dict[str, Any]:
    return {
        "object": "block",
        "type": "bulleted_list_item",
        "bulleted_list_item": {"rich_text": _rt(text)},
    }


def divider() -> dict[str, Any]:
    return {"object": "block", "type": "divider", "divider": {}}


def table(headers: list[str], rows: list[list[str]]) -> dict[str, Any]:
    """헤더+본문 표 (has_column_header). 셀은 문자열."""
    width = len(headers)

    def row(cells: list[str]) -> dict[str, Any]:
        # 열 수 맞추기
        padded = (cells + [""] * width)[:width]
        return {
            "object": "block",
            "type": "table_row",
            "table_row": {"cells": [_rt(c) for c in padded]},
        }

    return {
        "object": "block",
        "type": "table",
        "table": {
            "table_width": width,
            "has_column_header": True,
            "has_row_header": False,
            "children": [row(headers), *[row(r) for r in rows]],
        },
    }
