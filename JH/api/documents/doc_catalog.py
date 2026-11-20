"""문서함 목록·제목 검색 — 벡터 RAG 보완 (담당/기능·문서함 화면용)."""
from __future__ import annotations

import logging
import re
from typing import Any

from common.db import connect

log = logging.getLogger("jh.documents.doc_catalog")

DB = "DOCS_DATABASE_URL"
MAX_LIST = 15
MAX_LEXICAL_HITS = 8
CONTENT_MAX = 1200

_OWNERSHIP_KW = re.compile(
    r"담당|누가|기능|인벤|개발|만들었|인원|배정|각자|다른\s*사람|JH|HJ|TM|MS|DH",
    re.I,
)


def wants_doc_catalog(query: str, path: str) -> bool:
    p = (path or "").lower()
    if "/documents" in p or p.rstrip("/").endswith("documents"):
        return True
    return bool(_OWNERSHIP_KW.search(query or ""))


def _list_rows(conn, query: str) -> list[dict[str, Any]]:
    """최근 문서 + 질문 토큰이 제목/파일에 있으면 우선."""
    q = (query or "").strip()
    tokens = [t for t in re.split(r"\s+", q) if len(t) >= 2][:5]
    rows = list(
        conn.execute(
            """
            SELECT d.company_document_idx, d.title, d.file_name, d.category,
                   COALESCE(j.chunk_status, '없음') AS chunk_status
            FROM org.company_document d
            LEFT JOIN org.document_chunk_job j
              ON j.company_document_idx = d.company_document_idx
            ORDER BY d.uploaded_at DESC, d.company_document_idx DESC
            LIMIT 40
            """
        ).fetchall()
    )
    if not tokens:
        return rows[:MAX_LIST]

    def score(r: dict) -> int:
        blob = f"{r.get('title') or ''} {r.get('file_name') or ''}".lower()
        return sum(1 for t in tokens if t.lower() in blob)

    ranked = sorted(rows, key=score, reverse=True)
    # 매칭 있는 것 먼저, 없으면 최근순
    matched = [r for r in ranked if score(r) > 0]
    if matched:
        rest = [r for r in ranked if score(r) == 0]
        return (matched + rest)[:MAX_LIST]
    return ranked[:MAX_LIST]


def collect_catalog_text(query: str = "") -> str:
    """LLM용 문서함 목록 텍스트. 실패 시 빈 문자열."""
    try:
        with connect(DB) as conn:
            rows = _list_rows(conn, query)
        if not rows:
            return "(문서함 비어 있음)"
        lines = []
        for r in rows:
            idx = int(r["company_document_idx"])
            st = r.get("chunk_status") or "없음"
            lines.append(
                f"DOC-{idx} · {(r.get('title') or '').strip() or '(제목 없음)'} · "
                f"파일 {(r.get('file_name') or '')} · 분류 {r.get('category') or '-'} · "
                f"청킹 {st}"
            )
        return "\n".join(lines)
    except Exception:
        log.exception("문서함 목록 조회 실패")
        return ""


def lexical_chunk_hits(query: str, limit: int = MAX_LEXICAL_HITS) -> list[dict[str, Any]]:
    """제목/파일명 ILIKE → 청크 본문. 벡터 hits 부족 시 fallback."""
    q = (query or "").strip()
    if not q:
        return []
    # 너무 짧은·잡음 쿼리는 넓은 패턴
    patterns = []
    for t in re.split(r"[\s,./|]+", q):
        t = t.strip()
        if len(t) >= 2:
            patterns.append(f"%{t}%")
    for extra in ("인벤", "기능", "담당", "AIAX", "인원"):
        if extra in q or _OWNERSHIP_KW.search(q):
            patterns.append(f"%{extra}%")
    # 중복 제거
    seen: set[str] = set()
    pats: list[str] = []
    for p in patterns:
        if p not in seen:
            seen.add(p)
            pats.append(p)
    if not pats:
        pats = [f"%{q[:40]}%"]

    try:
        with connect(DB) as conn:
            # 문서 후보
            doc_ids: list[int] = []
            for pat in pats[:8]:
                found = conn.execute(
                    """
                    SELECT company_document_idx FROM org.company_document
                    WHERE title ILIKE %s OR file_name ILIKE %s
                    ORDER BY uploaded_at DESC
                    LIMIT 5
                    """,
                    [pat, pat],
                ).fetchall()
                for r in found:
                    i = int(r["company_document_idx"])
                    if i not in doc_ids:
                        doc_ids.append(i)
            if not doc_ids:
                return []

            hits: list[dict[str, Any]] = []
            for idx in doc_ids[:6]:
                chunks = conn.execute(
                    """
                    SELECT c.content, c.chunk_no, c.company_document_idx,
                           d.title, d.file_name, d.category
                    FROM org.document_chunk c
                    JOIN org.company_document d
                      ON d.company_document_idx = c.company_document_idx
                    WHERE c.company_document_idx = %s
                    ORDER BY c.chunk_no
                    LIMIT 3
                    """,
                    [idx],
                ).fetchall()
                for r in chunks:
                    hits.append(
                        {
                            "score": 0.5,
                            "company_document_idx": int(r["company_document_idx"]),
                            "doc_no": f"DOC-{int(r['company_document_idx'])}",
                            "title": r["title"],
                            "file_name": r["file_name"],
                            "category": r["category"],
                            "chunk_no": int(r["chunk_no"]),
                            "content": (r["content"] or "")[:CONTENT_MAX],
                        }
                    )
                    if len(hits) >= limit:
                        return hits
            return hits
    except Exception:
        log.exception("제목 검색 청크 실패")
        return []
