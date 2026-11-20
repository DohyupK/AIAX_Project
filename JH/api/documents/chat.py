"""Shift 봇 Chat — NIM 우선, 없으면 OpenAI. 문서 + 관리도 알림 + 품질 KPI."""
from __future__ import annotations

import logging
from typing import Any

from documents.llm_client import chat_model, get_openai_client

log = logging.getLogger("jh.documents.chat")

MAX_TOKENS = 1024

_SYSTEM = (
    "당신은 제조 AX 도우미 'Shift'입니다. "
    "아래 제공된 사내 문서 청크, 공정 관리도 알림, 품질 검사 KPI만 근거로 한국어로 답하세요. "
    "근거에 없는 내용은 추측하지 말고 모른다고 말하세요. "
    "문서는 [DOC-n], 관리도 알림은 [ALERT-…], 품질 KPI는 [QKPI-…] 형식으로 인용하세요."
)


def generate_answer(
    query: str,
    hits: list[dict[str, Any]],
    *,
    alert_text: str = "",
    quality_text: str = "",
) -> str:
    """문서 히트 + 관리도 알림 + 품질 KPI로 Chat Completions."""
    doc_blocks: list[str] = []
    for h in hits:
        doc_no = h.get("doc_no") or f"DOC-{h.get('company_document_idx')}"
        title = h.get("title") or ""
        chunk_no = h.get("chunk_no")
        body = (h.get("content") or "").strip()
        doc_blocks.append(f"[{doc_no}] {title} (chunk {chunk_no})\n{body}")
    doc_section = "\n\n".join(doc_blocks) if doc_blocks else "(문서 검색 결과 없음)"
    alert_section = alert_text.strip() if alert_text.strip() else "(관리도 알림 없음)"
    quality_section = quality_text.strip() if quality_text.strip() else "(품질 KPI 없음)"

    client = get_openai_client()
    model = chat_model()
    resp = client.chat.completions.create(
        model=model,
        max_tokens=MAX_TOKENS,
        temperature=0.2,
        messages=[
            {"role": "system", "content": _SYSTEM},
            {
                "role": "user",
                "content": (
                    f"질문: {query}\n\n"
                    f"--- 사내 문서 청크 ---\n{doc_section}\n\n"
                    f"--- 관리도 알림 (공정 최적화) ---\n{alert_section}\n\n"
                    f"--- 품질 검사 KPI ---\n{quality_section}"
                ),
            },
        ],
    )
    text = (resp.choices[0].message.content or "").strip()
    if not text:
        raise RuntimeError(f"Chat 응답이 비어 있습니다. (model={model})")
    return text
