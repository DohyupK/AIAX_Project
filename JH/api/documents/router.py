"""사내 문서함 API — 파일 DOCUMENT_ROOT, 메타 org.company_document, 청크/임베딩 BG."""
from __future__ import annotations

import logging
from pathlib import Path
from typing import Any

from fastapi import APIRouter, File, Form, Header, HTTPException, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

from common.db import connect
from documents.embed import cosine, embed_texts
from documents.jobs import schedule_chunk_job
from documents.paths import ALLOWED_EXT, MAX_FILE_BYTES, ext_of, file_path_for, safe_file_name

log = logging.getLogger("jh.documents")
router = APIRouter(prefix="/api/documents", tags=["documents"])
DB = "DOCS_DATABASE_URL"


def _resolve_uploader(x_employee_no: str | None) -> str:
    no = (x_employee_no or "e0001").strip()
    with connect(DB) as conn:
        row = conn.execute("SELECT employee_no FROM org.employee WHERE employee_no = %s", [no]).fetchone()
    if not row:
        raise HTTPException(400, f"등록되지 않은 사번입니다: {no}")
    return no


def _next_doc_idx(conn) -> int:
    r = conn.execute(
        "SELECT COALESCE(MAX(company_document_idx), 0) + 1 AS n FROM org.company_document"
    ).fetchone()
    return int(r["n"])


def _meta_row(r: dict[str, Any], uploader_name: str | None = None) -> dict[str, Any]:
    idx = int(r["company_document_idx"])
    path = Path(r["file_path"])
    size = path.stat().st_size if path.is_file() else 0
    uploaded_at = r["uploaded_at"]
    return {
        "company_document_idx": idx,
        "doc_no": f"DOC-{idx}",
        "title": r["title"],
        "description": "",
        "category": r["category"] or "regulation",
        "grade": "internal",
        "department": "",
        "uploader_id": r["uploaded_by"],
        "uploader": uploader_name or r["uploaded_by"],
        "created_at": uploaded_at.isoformat() if hasattr(uploaded_at, "isoformat") else str(uploaded_at),
        "file_name": r["file_name"],
        "file_size": size,
        "chunk_status": r.get("chunk_status"),
    }


@router.get("")
def list_documents():
    with connect(DB) as conn:
        rows = conn.execute(
            """
            SELECT d.*, i.employee_name, j.chunk_status
            FROM org.company_document d
            LEFT JOIN org.employee_info i ON i.employee_no = d.uploaded_by
            LEFT JOIN org.document_chunk_job j ON j.company_document_idx = d.company_document_idx
            ORDER BY d.uploaded_at DESC, d.company_document_idx DESC
            """
        ).fetchall()
    return [_meta_row(dict(r), r.get("employee_name")) for r in rows]


@router.post("", status_code=201)
async def upload_document(
    file: UploadFile = File(...),
    title: str = Form(...),
    category: str = Form(""),
    x_employee_no: str | None = Header(None, alias="X-Employee-No"),
):
    uploader = _resolve_uploader(x_employee_no)
    name = file.filename or "file"
    ext = ext_of(name)
    if ext not in ALLOWED_EXT:
        raise HTTPException(400, f"허용되지 않는 형식입니다. ({', '.join(sorted(ALLOWED_EXT))})")

    data = await file.read()
    if len(data) <= 0:
        raise HTTPException(400, "빈 파일은 올릴 수 없습니다.")
    if len(data) > MAX_FILE_BYTES:
        raise HTTPException(400, f"파일이 너무 큽니다. (최대 {MAX_FILE_BYTES} bytes)")

    title_s = title.strip()
    if not title_s:
        raise HTTPException(400, "제목을 입력하세요.")
    cat = category.strip() or None

    dest: Path | None = None
    try:
        with connect(DB) as conn:
            idx = _next_doc_idx(conn)
            dest = file_path_for(idx, name)
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_bytes(data)
            conn.execute(
                """
                INSERT INTO org.company_document
                  (company_document_idx, title, category, file_path, file_name, uploaded_by)
                VALUES (%s, %s, %s, %s, %s, %s)
                """,
                [idx, title_s, cat, str(dest), safe_file_name(name), uploader],
            )
            conn.execute(
                """
                INSERT INTO org.document_chunk_job (company_document_idx, chunk_status, attempt_count)
                VALUES (%s, 'pending', 0)
                """,
                [idx],
            )
            row = conn.execute(
                """
                SELECT d.*, i.employee_name, 'pending'::text AS chunk_status
                FROM org.company_document d
                LEFT JOIN org.employee_info i ON i.employee_no = d.uploaded_by
                WHERE d.company_document_idx = %s
                """,
                [idx],
            ).fetchone()
        schedule_chunk_job(idx)
        return _meta_row(dict(row), row.get("employee_name"))
    except Exception:
        if dest is not None and dest.exists():
            try:
                dest.unlink()
            except OSError:
                pass
        log.exception("문서 업로드 실패")
        raise


@router.get("/{doc_idx}/file")
def download_file(doc_idx: int):
    with connect(DB) as conn:
        row = conn.execute(
            "SELECT file_path, file_name FROM org.company_document WHERE company_document_idx = %s",
            [doc_idx],
        ).fetchone()
    if not row:
        raise HTTPException(404, "문서를 찾을 수 없습니다.")
    path = Path(row["file_path"])
    if not path.is_file():
        alt = file_path_for(doc_idx, row["file_name"])
        path = alt if alt.is_file() else path
    if not path.is_file():
        raise HTTPException(404, "파일이 없습니다.")
    return FileResponse(path, filename=row["file_name"])


@router.delete("/{doc_idx}", status_code=204)
def delete_document(
    doc_idx: int,
    x_employee_no: str | None = Header(None, alias="X-Employee-No"),
):
    uploader = _resolve_uploader(x_employee_no)
    with connect(DB) as conn:
        row = conn.execute(
            "SELECT file_path, uploaded_by FROM org.company_document WHERE company_document_idx = %s",
            [doc_idx],
        ).fetchone()
        if not row:
            raise HTTPException(404, "문서를 찾을 수 없습니다.")
        if row["uploaded_by"] != uploader:
            raise HTTPException(403, "본인이 올린 문서만 삭제할 수 있습니다.")
        path = Path(row["file_path"])
        conn.execute("DELETE FROM org.company_document WHERE company_document_idx = %s", [doc_idx])
    if path.is_file():
        try:
            path.unlink()
        except OSError:
            log.warning("파일 삭제 실패: %s", path)
    return None


class SearchBody(BaseModel):
    query: str = Field(..., min_length=1)
    limit: int = Field(10, ge=1, le=50)


@router.post("/search")
def search_documents(body: SearchBody):
    q = body.query.strip()
    if not q:
        raise HTTPException(400, "검색어를 입력하세요.")
    try:
        qvec = embed_texts([q])[0]
    except Exception as e:
        log.exception("검색 임베딩 실패")
        msg = str(e)
        if "OPENAI_API_KEY" in msg:
            raise HTTPException(503, msg) from e
        raise HTTPException(502, f"임베딩 실패: {e}") from e

    with connect(DB) as conn:
        rows = conn.execute(
            """
            SELECT e.embedding, c.content, c.chunk_no, c.company_document_idx,
                   d.title, d.file_name, d.category, d.uploaded_by, d.uploaded_at
            FROM org.document_chunk_embedding e
            JOIN org.document_chunk c ON c.document_chunk_idx = e.document_chunk_idx
            JOIN org.company_document d ON d.company_document_idx = c.company_document_idx
            """
        ).fetchall()

    scored: list[tuple[float, dict]] = []
    for r in rows:
        emb = list(r["embedding"]) if r["embedding"] is not None else []
        score = cosine(qvec, emb)
        scored.append(
            (
                score,
                {
                    "score": round(score, 4),
                    "company_document_idx": int(r["company_document_idx"]),
                    "doc_no": f"DOC-{int(r['company_document_idx'])}",
                    "title": r["title"],
                    "file_name": r["file_name"],
                    "category": r["category"],
                    "chunk_no": int(r["chunk_no"]),
                    "content": r["content"][:400],
                },
            )
        )
    scored.sort(key=lambda x: x[0], reverse=True)
    return [item for _, item in scored[: body.limit]]
