"""문서함 목록·제목 검색·본문 즉시 추출 — 벡터 RAG 보완 (담당/기능·문서함 화면용)."""
from __future__ import annotations

import logging
import re
from pathlib import Path
from typing import Any

from common.db import connect
from documents.chunk import split_text
from documents.extract import extract_text
from documents.jobs import schedule_chunk_job
from documents.paths import file_path_for

log = logging.getLogger("jh.documents.doc_catalog")

DB = "DOCS_DATABASE_URL"
MAX_LIST = 15
MAX_LEXICAL_HITS = 8
CONTENT_MAX = 1200
LIVE_CHUNK_CAP = 4  # 즉시 추출 시 LLM에 넣을 청크 수

_OWNERSHIP_KW = re.compile(
    r"담당|누가|기능|인벤|개발|만들었|인원|배정|각자|다른\s*사람|JH|HJ|TM|MS|DH|내용|요약|문서",
    re.I,
)


def wants_doc_catalog(query: str, path: str) -> bool:
    p = (path or "").lower()
    if "/documents" in p or p.rstrip("/").endswith("documents"):
        return True
    return bool(_OWNERSHIP_KW.search(query or ""))


def _is_meta_only(content: str) -> bool:
    """제목 메타만 있는 청크 (본문 추출 실패 시 jobs가 넣은 것)."""
    c = (content or "").strip()
    if not c:
        return True
    if c.startswith("제목:") and "\n\n" not in c and len(c) < 400:
        return True
    # 메타 3줄만
    lines = [ln for ln in c.splitlines() if ln.strip()]
    if len(lines) <= 3 and all(
        ln.startswith("제목:") or ln.startswith("파일:") or ln.startswith("분류:") for ln in lines
    ):
        return True
    return False


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


def _match_doc_ids(conn, query: str) -> list[int]:
    q = (query or "").strip()
    patterns: list[str] = []
    for t in re.split(r"[\s,./|]+", q):
        t = t.strip()
        if len(t) >= 2:
            patterns.append(f"%{t}%")
    for extra in ("인벤", "기능", "담당", "AIAX", "인원", "인벤토리"):
        if extra in q or _OWNERSHIP_KW.search(q):
            patterns.append(f"%{extra}%")
    seen: set[str] = set()
    pats: list[str] = []
    for p in patterns:
        if p not in seen:
            seen.add(p)
            pats.append(p)
    if not pats:
        pats = [f"%{q[:40]}%"] if q else []

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
    return doc_ids


def _resolve_path(doc_idx: int, file_path: str | None, file_name: str) -> Path | None:
    if file_path:
        p = Path(file_path)
        if p.is_file():
            return p
    alt = file_path_for(doc_idx, file_name or "file")
    return alt if alt.is_file() else None


def _live_extract_hits(doc_idx: int) -> list[dict[str, Any]]:
    """파일에서 즉시 본문 추출 → synthetic hits. 재청킹 예약."""
    try:
        with connect(DB) as conn:
            doc = conn.execute(
                """
                SELECT company_document_idx, title, file_name, category, file_path
                FROM org.company_document WHERE company_document_idx = %s
                """,
                [doc_idx],
            ).fetchone()
        if not doc:
            return []
        path = _resolve_path(doc_idx, doc.get("file_path"), doc.get("file_name") or "")
        if not path:
            log.warning("DOC-%s 파일 없음 — 즉시 추출 불가", doc_idx)
            return []
        text = extract_text(path, doc["file_name"] or path.name)
        parts = split_text(text)
        if not parts:
            log.warning("DOC-%s 즉시 추출 본문 비어 있음", doc_idx)
            return []
        hits: list[dict[str, Any]] = []
        for i, part in enumerate(parts[:LIVE_CHUNK_CAP], start=1):
            hits.append(
                {
                    "score": 0.55,
                    "company_document_idx": doc_idx,
                    "doc_no": f"DOC-{doc_idx}",
                    "title": doc.get("title"),
                    "file_name": doc.get("file_name"),
                    "category": doc.get("category"),
                    "chunk_no": i,
                    "content": part[:CONTENT_MAX],
                }
            )
        try:
            schedule_chunk_job(doc_idx)
            log.info("DOC-%s 즉시 추출 %d청크 + 재청킹 예약", doc_idx, len(hits))
        except Exception:
            log.exception("DOC-%s 재청킹 예약 실패 (본문 주입은 유지)", doc_idx)
        return hits
    except Exception:
        log.exception("DOC-%s 즉시 추출 실패", doc_idx)
        return []


def lexical_chunk_hits(query: str, limit: int = MAX_LEXICAL_HITS) -> list[dict[str, Any]]:
    """제목/파일명 ILIKE → 청크 본문. 없거나 메타만이면 파일 즉시 추출."""
    q = (query or "").strip()
    if not q:
        return []

    try:
        with connect(DB) as conn:
            doc_ids = _match_doc_ids(conn, q)
            if not doc_ids:
                return []

            hits: list[dict[str, Any]] = []
            need_live: list[int] = []

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
                    LIMIT 5
                    """,
                    [idx],
                ).fetchall()
                real = [r for r in chunks if not _is_meta_only(r.get("content") or "")]
                if not real:
                    need_live.append(idx)
                    continue
                for r in real[:3]:
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

            for idx in need_live:
                if len(hits) >= limit:
                    break
                for h in _live_extract_hits(idx):
                    hits.append(h)
                    if len(hits) >= limit:
                        break
            return hits
    except Exception:
        log.exception("제목 검색 청크 실패")
        return []


def ensure_live_bodies(query: str, hits: list[dict[str, Any]], limit: int = 10) -> list[dict[str, Any]]:
    """hits에 본문이 없거나 메타만이면 매칭 문서 즉시 추출로 채움."""
    real = [h for h in hits if not _is_meta_only(h.get("content") or "")]
    if len(real) >= 2:
        return real[:limit]
    lex = lexical_chunk_hits(query, limit=limit)
    if not lex:
        return real[:limit] if real else hits
    # 실본문 hits 우선, 이어서 즉시추출/제목검색
    out = list(real)
    have_body = {h.get("company_document_idx") for h in out}
    for h in lex:
        idx = h.get("company_document_idx")
        if idx in have_body:
            continue
        out.append(h)
        have_body.add(idx)
        if len(out) >= limit:
            break
    return out[:limit]
