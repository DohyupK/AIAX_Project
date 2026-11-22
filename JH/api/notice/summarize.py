"""전날 관리도 알림 → 회사 공지 제목·본문 (documents.llm_client 재사용)."""
from __future__ import annotations

import json
import logging
import re
from typing import Any

from casting.alerts_daily import AlertCard, GRADE_NAME
from documents.llm_client import chat_model, get_openai_client

log = logging.getLogger("jh.notice.summarize")

MAX_CARDS = 30
MAX_TOKENS = 800

_SYSTEM = (
    "당신은 다이캐스팅 공장의 생산·품질 브리핑 작성자입니다. "
    "전날 관리도(SPC) 알림만 근거로, 오늘 근무자가 아침에 읽을 "
    "「회사 전체 공지」용 한국어 요약을 만듭니다. "
    "추측·없는 수치 창작 금지. 중요도: 경보 > 주의 > 관찰. "
    "반드시 JSON 한 객체만 출력: "
    '{"title":"한 줄 제목(50자 이내)","content":"본문(줄바꿈 허용, 400자 이내)"}'
)


def _card_lines(cards: list[AlertCard]) -> str:
    ranked = sorted(cards, key=lambda c: (-{"alarm": 3, "caution": 2, "watch": 1}[c.grade], c.time, c.shot_id))
    lines: list[str] = []
    for c in ranked[:MAX_CARDS]:
        guide = c.guide or ""
        extra = f" | {c.extra}" if c.extra else ""
        lines.append(
            f"[{GRADE_NAME[c.grade]}] {c.line} {c.time} #{c.shot_id} {c.title} — {guide}{extra}"
        )
    return "\n".join(lines)


def summarize_alerts(source_date: str, cards: list[AlertCard], stats: dict[str, Any]) -> tuple[str, str, str]:
    """(title, content, model_name). 예외는 호출측에서 처리."""
    bg = stats.get("by_grade") or {}
    summary = (
        f"집계일 {source_date}, 총 {stats.get('total', 0)}건 "
        f"(경보 {bg.get('alarm', 0)} · 주의 {bg.get('caution', 0)} · 관찰 {bg.get('watch', 0)})"
    )
    user = (
        f"{summary}\n라인별: {json.dumps(stats.get('by_line') or {}, ensure_ascii=False)}\n\n"
        f"--- 알림 (중요도 순, 최대 {MAX_CARDS}건) ---\n{_card_lines(cards)}"
    )
    client = get_openai_client()
    model = chat_model()
    resp = client.chat.completions.create(
        model=model,
        max_tokens=MAX_TOKENS,
        temperature=0.2,
        messages=[
            {"role": "system", "content": _SYSTEM},
            {"role": "user", "content": user},
        ],
    )
    text = (resp.choices[0].message.content or "").strip()
    if not text:
        raise RuntimeError(f"일일 공지 Chat 응답이 비어 있습니다. (model={model})")
    title, content = _parse_json(text, source_date, stats)
    return title, content, model


def _parse_json(text: str, source_date: str, stats: dict[str, Any]) -> tuple[str, str]:
    raw = text.strip()
    fence = re.search(r"```(?:json)?\s*([\s\S]*?)```", raw)
    if fence:
        raw = fence.group(1).strip()
    try:
        obj = json.loads(raw)
        title = str(obj.get("title") or "").strip()
        content = str(obj.get("content") or "").strip()
        if title and content:
            return title[:80], content[:2000]
    except json.JSONDecodeError:
        log.warning("일일 공지 JSON 파싱 실패 — 본문 그대로 사용")
    bg = stats.get("by_grade") or {}
    fallback_title = (
        f"{source_date[5:].replace('-', '/')} 공정 알람 브리핑 "
        f"(경보 {bg.get('alarm', 0)}·주의 {bg.get('caution', 0)})"
    )
    return fallback_title[:80], raw[:2000]


def empty_notice(source_date: str) -> tuple[str, str]:
    """알림 0건 — LLM 없이 고정 문구."""
    md = source_date[5:].replace("-", "/")
    return (
        f"{md} 공정 관리도 알림 요약 — 이상 없음",
        f"전일({source_date}) 다이캐스팅 라인 1~3 관리도 경보·주의·관찰 알림이 없었습니다.\n"
        "정상 가동으로 보이며, 특이 점검은 공정 최적화 화면에서 확인해 주십시오.",
    )
