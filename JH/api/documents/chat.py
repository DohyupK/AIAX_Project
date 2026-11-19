"""혜진봇 Chat — NIM(meta/llama-3.1-8b-instruct) 우선, 없으면 OpenAI gpt-4o-mini."""
from __future__ import annotations

import logging
from typing import Any

from documents.llm_client import chat_model, get_openai_client

log = logging.getLogger("jh.documents.chat")

MAX_TOKENS = 1024

_SYSTEM = (
    "당신은 사내 문서 기반 도우미 '혜진봇'입니다. "
    "아래 제공된 문서 청크만 근거로 한국어로 답하세요. "
    "청크에 없는 내용은 추측하지 말고 모른다고 말하세요. "
    "답변 본문에 근거 문서 번호를 [DOC-n] 형식으로 인용하세요."
)


def generate_answer(query: str, hits: list[dict[str, Any]]) -> str:
    """검색 히트를 컨텍스트로 Chat Completions 호출. 예외는 호출측에서 HTTP로 변환."""
    blocks: list[str] = []
    for h in hits:
        doc_no = h.get("doc_no") or f"DOC-{h.get('company_document_idx')}"
        title = h.get("title") or ""
        chunk_no = h.get("chunk_no")
        body = (h.get("content") or "").strip()
        blocks.append(f"[{doc_no}] {title} (chunk {chunk_no})\n{body}")
    context = "\n\n".join(blocks)

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
                "content": f"질문: {query}\n\n--- 문서 청크 ---\n{context}",
            },
        ],
    )
    text = (resp.choices[0].message.content or "").strip()
    if not text:
        raise RuntimeError(f"Chat 응답이 비어 있습니다. (model={model})")
    return text
