"""Shift 봇 Chat — NIM 우선, 없으면 OpenAI. 멀티턴 + 문서/알림/KPI/화면 맥락."""
from __future__ import annotations

import logging
from typing import Any

from documents.llm_client import chat_model, get_openai_client

log = logging.getLogger("jh.documents.chat")

MAX_TOKENS = 1536
MAX_HISTORY = 6  # user/assistant 메시지 최대 (3왕복)

_SYSTEM = (
    "당신은 제조 AX 도우미 'Shift'입니다. 일반 현장 직원도 바로 이해하도록 "
    "쉬운 한국어·짧은 문장으로 답하세요. 어려운 용어는 필요할 때만 쓰고 바로 풀어 주세요. "
    "답변 본문에 DOC-2, ALERT-line_no1|…, QKPI-… 같은 긴 ID·대괄호 코드를 나열하지 마세요. "
    "근거는 「사내 문서 ○○」「관리도 알림(냉각수 온도)」「라인1 품질 지표」처럼 말로 적으세요. "
    "질문에 해당하는 근거만 쓰세요. 관리도 알림·품질 KPI 섹션이 비어 있거나 질문과 무관하면 "
    "냉각수·불량률·주입 압력 등 공정 현황을 답에 넣지 마세요. "
    "담당·기능·누가 만들었나 질문은 「문서함 목록」과 「사내 문서 청크」를 우선 쓰세요. "
    "목록에 파일이 있으면 「문서에 없습니다」만 반복하지 말고, 파일 이름과 청킹 상태"
    "(ok면 본문 요약, pending/실패면 업로드됨·검색용 본문 준비 중)를 말하세요. "
    "청크 본문이 있을 때만 내용을 요약하세요. 없는 내용을 지어내지 마세요. "
    "질문이 공정·품질과 관련될 때만 알림·KPI를 요약·분석해도 됩니다. "
    "답변에 마크다운 강조(**볼드**, *이탤릭*, # 제목, 백틱 코드)를 쓰지 마세요. 평범한 문장만 쓰세요. "
    "이전 대화가 있으면 이어서 답하세요."
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


def generate_answer(
    query: str,
    hits: list[dict[str, Any]],
    *,
    alert_text: str = "",
    quality_text: str = "",
    ui_context_text: str = "",
    catalog_text: str = "",
    history: list[dict[str, Any]] | None = None,
) -> str:
    """문서 히트 + 목록 + 알림 + KPI + 화면 맥락 + 멀티턴. 대화 DB 저장 없음."""
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

    messages: list[dict[str, str]] = [{"role": "system", "content": _SYSTEM}]
    messages.extend(_sanitize_history(history))
    messages.append(
        {
            "role": "user",
            "content": (
                f"질문: {query}\n\n"
                f"--- 문서함 목록 ---\n{catalog_section}\n\n"
                f"--- 사내 문서 청크 ---\n{doc_section}\n\n"
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
        temperature=0.4,
        messages=messages,
    )
    text = (resp.choices[0].message.content or "").strip()
    if not text:
        raise RuntimeError(f"Chat 응답이 비어 있습니다. (model={model})")
    return text
