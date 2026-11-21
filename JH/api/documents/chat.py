"""Shift 봇 Chat — NIM 우선, 없으면 OpenAI. 멀티턴 + 문서/알림/KPI/화면 맥락."""
from __future__ import annotations

import json
import logging
import re
from pathlib import Path
from typing import Any

from documents.llm_client import chat_model, get_openai_client

log = logging.getLogger("jh.documents.chat")

MAX_TOKENS = 1536
MAX_HISTORY = 6  # user/assistant 메시지 최대 (3왕복)
FULL_READ_CAP = 12_000  # 노력치로 불러오는 문서당 전문 상한

_SYSTEM = (
    "당신은 제조 AX 도우미 'Shift'입니다. 현장 동료처럼 쉬운 한국어로 답하세요. "
    "아래에 주는 자료(문서 청크·문서함 목록·관리도 알림·품질 KPI·화면 맥락)와 "
    "이전 대화를 보고, 질문에 필요한 것만 골라 답하세요. "
    "자료에 없는 사실은 만들지 마세요. "
    "마크다운 강조와 DOC-/ALERT-/QKPI- 같은 내부 ID는 쓰지 마세요."
)

_EFFORT_SYSTEM = (
    "내부 판단만 한다. JSON만 출력한다. 사용자에게 말할 문장은 쓰지 않는다. "
    '형식: {"need_full":true|false,"doc_idxs":[1,2]}'
)


def _sanitize_history(history: list[dict[str, Any]] | None) -> list[dict[str, str]]:
    out: list[dict[str, str]] = []
    for m in history or []:
        role = m.get("role")
        content = (m.get("content") or "").strip()
        if role not in ("user", "assistant") or not content:
            continue
        out.append({"role": role, "content": content[:4000]})
    return out[-MAX_HISTORY:]


def decide_full_read(
    query: str,
    hits: list[dict[str, Any]],
    history: list[dict[str, Any]] | None = None,
) -> tuple[bool, list[int]]:
    """사용자에게 보이지 않는 1회 노력치 — 전문이 더 필요한지 JSON으로만 판단."""
    if not hits:
        return False, []
    available = sorted(
        {
            int(h.get("company_document_idx") or 0)
            for h in hits
            if int(h.get("company_document_idx") or 0) > 0
        }
    )
    if not available:
        return False, []

    doc_lines = []
    for h in hits[:12]:
        idx = h.get("company_document_idx")
        title = h.get("title") or ""
        snippet = (h.get("content") or "")[:400]
        doc_lines.append(f"idx={idx} title={title}\n{snippet}")
    blob = "\n\n".join(doc_lines)

    messages: list[dict[str, str]] = [
        {"role": "system", "content": _EFFORT_SYSTEM},
        *_sanitize_history(history),
        {
            "role": "user",
            "content": (
                f"질문: {query}\n"
                f"후보 문서 idx: {available}\n"
                f"청크 일부:\n{blob}"
            ),
        },
    ]
    try:
        client = get_openai_client()
        resp = client.chat.completions.create(
            model=chat_model(),
            max_tokens=120,
            temperature=0.1,
            messages=messages,
        )
        raw = (resp.choices[0].message.content or "").strip()
    except Exception:
        log.exception("노력치 판단 실패 — 청크만 사용")
        return False, []

    need, idxs = _parse_effort_json(raw, available)
    log.info("노력치 need_full=%s doc_idxs=%s", need, idxs)
    return need, idxs


def _parse_effort_json(raw: str, allowed: list[int]) -> tuple[bool, list[int]]:
    allow = set(allowed)
    text = raw.strip()
    m = re.search(r"\{[^{}]*\}", text, re.S)
    if m:
        text = m.group(0)
    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        return False, []
    need = bool(data.get("need_full"))
    raw_ids = data.get("doc_idxs") or data.get("doc_ids") or []
    idxs: list[int] = []
    if isinstance(raw_ids, list):
        for x in raw_ids:
            try:
                i = int(x)
            except (TypeError, ValueError):
                continue
            if i in allow and i not in idxs:
                idxs.append(i)
    if need and not idxs:
        idxs = list(allowed)[:3]
    if not need:
        return False, []
    return True, idxs[:3]


def fetch_full_document_texts(doc_idxs: list[int], *, cap: int = FULL_READ_CAP) -> str:
    """파일에서 전문 추출 (서버만). 실패 문서는 건너뜀."""
    if not doc_idxs:
        return ""
    from common.db import connect
    from documents.extract import extract_text
    from documents.paths import file_path_for

    blocks: list[str] = []
    try:
        with connect("DOCS_DATABASE_URL") as conn:
            for doc_idx in doc_idxs:
                row = conn.execute(
                    """
                    SELECT company_document_idx, title, file_name, file_path
                    FROM org.company_document WHERE company_document_idx = %s
                    """,
                    [doc_idx],
                ).fetchone()
                if not row:
                    continue
                path: Path | None = None
                fp = row.get("file_path")
                if fp:
                    p = Path(fp)
                    if p.is_file():
                        path = p
                if path is None:
                    alt = file_path_for(doc_idx, row.get("file_name") or "file")
                    path = alt if alt.is_file() else None
                if path is None:
                    log.warning("노력치 전문: DOC-%s 파일 없음", doc_idx)
                    continue
                try:
                    text = extract_text(path, row.get("file_name") or path.name)
                except Exception:
                    log.exception("노력치 전문 추출 실패 DOC-%s", doc_idx)
                    continue
                text = (text or "").strip()
                if not text:
                    continue
                title = (row.get("title") or "").strip() or f"DOC-{doc_idx}"
                blocks.append(f"[{title}]\n{text[:cap]}")
    except Exception:
        log.exception("노력치 전문 조회 실패")
        return ""
    return "\n\n".join(blocks)


def generate_answer(
    query: str,
    hits: list[dict[str, Any]],
    *,
    alert_text: str = "",
    quality_text: str = "",
    ui_context_text: str = "",
    catalog_text: str = "",
    full_text: str = "",
    history: list[dict[str, Any]] | None = None,
) -> str:
    """문서 히트 + (선택)전문 + 목록 + 알림 + KPI + 화면 맥락 + 멀티턴."""
    doc_blocks: list[str] = []
    for h in hits:
        doc_no = h.get("doc_no") or f"DOC-{h.get('company_document_idx')}"
        title = h.get("title") or ""
        chunk_no = h.get("chunk_no")
        body = (h.get("content") or "").strip()
        doc_blocks.append(f"[{doc_no}] {title} (chunk {chunk_no})\n{body}")
    doc_section = "\n\n".join(doc_blocks) if doc_blocks else "(문서 검색 결과 없음)"
    catalog_section = catalog_text.strip() if catalog_text.strip() else "(문서함 목록 없음)"
    alert_section = alert_text.strip() if alert_text.strip() else "(관리도 알림 없음)"
    quality_section = quality_text.strip() if quality_text.strip() else "(품질 KPI 없음)"
    ui_section = ui_context_text.strip() if ui_context_text.strip() else "(화면 맥락 없음)"
    full_section = full_text.strip() if full_text.strip() else "(없음)"

    messages: list[dict[str, str]] = [{"role": "system", "content": _SYSTEM}]
    messages.extend(_sanitize_history(history))
    messages.append(
        {
            "role": "user",
            "content": (
                f"질문: {query}\n\n"
                f"--- 문서함 목록 ---\n{catalog_section}\n\n"
                f"--- 사내 문서 청크 (근거 자료) ---\n{doc_section}\n\n"
                f"--- 문서 전문 (있을 때만) ---\n{full_section}\n\n"
                f"--- 관리도 알림 (공정 최적화) ---\n{alert_section}\n\n"
                f"--- 품질 검사 KPI ---\n{quality_section}\n\n"
                f"--- 화면 맥락 ---\n{ui_section}"
            ),
        }
    )

    client = get_openai_client()
    model = chat_model()
    resp = client.chat.completions.create(
        model=model,
        max_tokens=MAX_TOKENS,
        temperature=0.55,
        messages=messages,
    )
    text = (resp.choices[0].message.content or "").strip()
    if not text:
        raise RuntimeError(f"Chat 응답이 비어 있습니다. (model={model})")
    return text
