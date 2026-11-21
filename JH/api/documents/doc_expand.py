"""후속 질문·문서명 힌트 → 해당 문서 청크 확장 (리랭커 없이)."""
from __future__ import annotations

import logging
import re
from typing import Any

from common.db import connect

log = logging.getLogger("jh.documents.doc_expand")

DB = "DOCS_DATABASE_URL"
EXPAND_CHUNK_CAP = 12
EXPAND_CONTENT_MAX = 2000
TITLE_BOOST = 0.08  # 코사인 점수에 제목·파일명 부분일치 가산

_DOC_NO = re.compile(r"DOC-(\d+)", re.I)
# 너무 짧은 토큰·조사만 있는 조각 제외
_STOP = {
    "문서",
    "파일",
    "내용",
    "요약",
    "분석",
    "설명",
    "자세히",
    "알려",
    "말해",
    "주세요",
    "해줘",
    "무엇",
    "뭐야",
    "뭔가",
    "관련",
    "대해",
    "대한",
}


def _blob_from_history(history: list[dict[str, Any]] | None) -> str:
    parts: list[str] = []
    for m in history or []:
        c = (m.get("content") or "").strip()
        if c:
            parts.append(c)
    return "\n".join(parts)


def _tokens(text: str) -> list[str]:
    raw = re.split(r"[\s,/|·•\-_:;()\[\]「」『』\"']+", text or "")
    out: list[str] = []
    for t in raw:
        t = t.strip()
        if len(t) < 2:
            continue
        if t.lower() in _STOP or t in _STOP:
            continue
        if t.isdigit():
            continue
        out.append(t)
    # 긴 토큰 우선·중복 제거
    seen: set[str] = set()
    uniq: list[str] = []
    for t in sorted(out, key=len, reverse=True):
        key = t.lower()
        if key in seen:
            continue
        seen.add(key)
        uniq.append(t)
        if len(uniq) >= 12:
            break
    return uniq


def resolve_doc_hint_ids(
    query: str,
    history: list[dict[str, Any]] | None = None,
) -> list[int]:
    """질의·히스토리에서 DOC-n·제목/파일명 부분일치 → company_document_idx."""
    text = f"{query or ''}\n{_blob_from_history(history)}"
    ids: list[int] = []
    seen: set[int] = set()

    for m in _DOC_NO.finditer(text):
        idx = int(m.group(1))
        if idx not in seen:
            seen.add(idx)
            ids.append(idx)

    tokens = _tokens(f"{query or ''} {_blob_from_history(history)}")
    if not tokens and not ids:
        return []

    try:
        with connect(DB) as conn:
            rows = conn.execute(
                """
                SELECT company_document_idx, title, file_name
                FROM org.company_document
                ORDER BY uploaded_at DESC
                LIMIT 80
                """
            ).fetchall()
    except Exception:
        log.exception("문서 힌트 목록 조회 실패")
        return ids

    scored: list[tuple[int, int]] = []
    for r in rows:
        idx = int(r["company_document_idx"])
        if idx in seen:
            continue
        blob = f"{r.get('title') or ''} {r.get('file_name') or ''}".lower()
        hit = sum(1 for t in tokens if t.lower() in blob)
        if hit > 0:
            scored.append((hit, idx))
    scored.sort(key=lambda x: (-x[0], -x[1]))
    for _, idx in scored[:5]:
        if idx not in seen:
            seen.add(idx)
            ids.append(idx)
    return ids


def fetch_chunks_for_docs(
    doc_ids: list[int],
    *,
    max_chunks: int = EXPAND_CHUNK_CAP,
    content_max: int = EXPAND_CONTENT_MAX,
) -> list[dict[str, Any]]:
    """문서 idx들의 청크를 chunk_no 순으로 모아 반환."""
    if not doc_ids:
        return []
    out: list[dict[str, Any]] = []
    try:
        with connect(DB) as conn:
            for doc_idx in doc_ids:
                rows = conn.execute(
                    """
                    SELECT c.content, c.chunk_no, c.company_document_idx,
                           d.title, d.file_name, d.category
                    FROM org.document_chunk c
                    JOIN org.company_document d
                      ON d.company_document_idx = c.company_document_idx
                    WHERE c.company_document_idx = %s
                    ORDER BY c.chunk_no
                    LIMIT %s
                    """,
                    [doc_idx, max_chunks],
                ).fetchall()
                for r in rows:
                    out.append(
                        {
                            "score": 1.0,
                            "company_document_idx": int(r["company_document_idx"]),
                            "doc_no": f"DOC-{int(r['company_document_idx'])}",
                            "title": r["title"],
                            "file_name": r["file_name"],
                            "category": r["category"],
                            "chunk_no": int(r["chunk_no"]),
                            "content": (r.get("content") or "")[:content_max],
                        }
                    )
                    if len(out) >= max_chunks:
                        return out
    except Exception:
        log.exception("문서 청크 확장 조회 실패")
    return out


def merge_expanded_hits(
    expanded: list[dict[str, Any]],
    retrieved: list[dict[str, Any]],
    *,
    limit: int = 10,
) -> list[dict[str, Any]]:
    """확장 청크를 앞에 두고 검색 히트 병합. (idx, chunk_no) 중복 제거."""
    seen: set[tuple[int, int]] = set()
    merged: list[dict[str, Any]] = []
    for h in [*expanded, *retrieved]:
        idx = int(h.get("company_document_idx") or 0)
        cno = int(h.get("chunk_no") or 0)
        key = (idx, cno)
        if key in seen:
            continue
        seen.add(key)
        merged.append(h)
        if len(merged) >= max(limit, EXPAND_CHUNK_CAP):
            break
    return merged


def title_match_boost(query: str, title: str, file_name: str) -> float:
    """제목·파일명 부분일치 시 코사인에 더할 가산점."""
    q = (query or "").strip().lower()
    if len(q) < 2:
        return 0.0
    blob = f"{title or ''} {file_name or ''}".lower()
    if not blob.strip():
        return 0.0
    tokens = [t for t in re.split(r"\s+", q) if len(t) >= 2][:8]
    if not tokens:
        return 0.0
    hits = sum(1 for t in tokens if t in blob)
    if hits <= 0:
        return 0.0
    # 최대 1회 분량의 부스트 (여러 토큰이면 소폭 가산)
    return min(TITLE_BOOST * (1 + 0.25 * (hits - 1)), TITLE_BOOST * 2)
