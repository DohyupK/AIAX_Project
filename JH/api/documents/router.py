"""사내 문서함 API — 파일 DOCUMENT_ROOT, 메타 org.company_document, 청크/임베딩 BG.
문서 내용 보기: pdf·이미지 = /file 원본, docx·xlsx·pptx = /preview (LibreOffice PDF 변환), hwpx·hwp·txt = /text (본문 텍스트)."""
from __future__ import annotations

import logging
import re
from pathlib import Path
from typing import Any

from fastapi import APIRouter, File, Form, Header, HTTPException, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

from common.db import connect
from documents import preview
from documents.chat import generate_answer
from documents.embed import cosine, embed_texts
from documents.extract import extract_text
from documents.jobs import schedule_chunk_job
from documents.paths import ALLOWED_EXT, EXTRACT_EXT, MAX_FILE_BYTES, ext_of, file_path_for, safe_file_name

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
        "category": r["category"] or "regulation",
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


def _stored_file(doc_idx: int) -> tuple[Path, str]:
    """문서 번호 → (저장된 파일 경로, 원래 파일 이름). 없으면 404"""
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
    return path, row["file_name"]


@router.get("/{doc_idx}/file")
def download_file(doc_idx: int):
    path, name = _stored_file(doc_idx)
    return FileResponse(path, filename=name)


@router.get("/{doc_idx}/preview")
def preview_pdf(doc_idx: int):
    """docx·xlsx·pptx 원본 모양 보기 (PDF 변환본). LibreOffice 미설치면 501 → 화면이 /text 로 대신"""
    path, name = _stored_file(doc_idx)
    if ext_of(name) not in preview.CONVERT_EXT:
        raise HTTPException(415, "PDF 변환 대상이 아닌 형식입니다.")
    try:
        pdf = preview.converted_pdf(doc_idx, path, name)
    except Exception:
        log.exception("문서 PDF 변환 실패 doc=%s", doc_idx)
        raise HTTPException(500, "문서를 PDF로 변환하지 못했습니다.")
    if pdf is None:
        raise HTTPException(501, "서버에 문서 변환 도구(LibreOffice)가 설치되지 않았습니다.")
    return FileResponse(pdf, media_type="application/pdf", content_disposition_type="inline")


TEXT_LIMIT = 20_000   # 내용 보기 최대 글자 수 (넘으면 잘라서 truncated)


@router.get("/{doc_idx}/text")
def document_text(doc_idx: int):
    """본문 텍스트 (hwpx·txt, LibreOffice 없을 때 docx·xlsx·pptx). hwp(바이너리)는 추출기 승인 전이라 빈 텍스트"""
    path, name = _stored_file(doc_idx)
    if ext_of(name) not in EXTRACT_EXT:
        raise HTTPException(415, "본문 텍스트를 뽑을 수 없는 형식입니다.")
    try:
        text = extract_text(path, name)
    except Exception:
        raise HTTPException(500, "본문 텍스트를 읽지 못했습니다.")   # 원인은 extract_text 가 로그에 남김
    return {"text": text[:TEXT_LIMIT], "truncated": len(text) > TEXT_LIMIT, "chars": len(text)}


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
    preview.remove_cache(doc_idx)
    if path.is_file():
        try:
            path.unlink()
        except OSError:
            log.warning("파일 삭제 실패: %s", path)
    return None


MIN_SCORE = 0.25  # 이하면 무관 문서로 간주 (top-k만으로는 노이즈)


class HistoryMsg(BaseModel):
    role: str
    content: str = Field(..., max_length=4000)


class UiAction(BaseModel):
    t: str = ""
    kind: str = ""
    label: str = Field("", max_length=80)


class UiContext(BaseModel):
    path: str = Field("", max_length=200)
    page_label: str = Field("", max_length=80)
    actions: list[UiAction] = Field(default_factory=list)


class SearchBody(BaseModel):
    query: str = Field(..., min_length=1)
    limit: int = Field(10, ge=1, le=10)
    history: list[HistoryMsg] = Field(default_factory=list)
    ui_context: UiContext | None = None


def _ui_context_text(ui: UiContext | None) -> str:
    if not ui:
        return ""
    lines = [
        f"경로: {ui.path or '(없음)'}",
        f"페이지: {ui.page_label or '(없음)'}",
    ]
    acts = ui.actions[-15:]
    if acts:
        lines.append("최근 동작:")
        for a in acts:
            label = (a.label or "").strip()[:80]
            if label:
                lines.append(f"  - [{a.kind or 'act'}] {label}")
    return "\n".join(lines)


def _retrieve_hits(query: str, limit: int) -> list[dict[str, Any]]:
    """의미검색 top-k + min_score. 임베딩 실패는 HTTPException."""
    from documents.llm_client import embed_dim

    try:
        qvec = embed_texts([query], input_type="query")[0]
    except Exception as e:
        log.exception("검색 임베딩 실패")
        msg = str(e)
        if "API_KEY" in msg:
            raise HTTPException(503, msg) from e
        raise HTTPException(502, f"임베딩 실패: {e}") from e

    want_dim = embed_dim()
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
        # 이전 공급자 차원(1536↔2048) 벡터는 검색에서 제외
        if len(emb) != want_dim:
            continue
        score = cosine(qvec, emb)
        if score < MIN_SCORE:
            continue
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
                    "content": r["content"][:1200],
                },
            )
        )
    scored.sort(key=lambda x: x[0], reverse=True)
    return [item for _, item in scored[:limit]]


def _wants_quality_kpi(query: str, path: str) -> bool:
    """품질 KPI는 품질·불량 질문/화면일 때만."""
    p = (path or "").lower()
    if "quality-inspection" in p or "defect-labeling" in p:
        return True
    return bool(re.search(r"불량|품질|kpi|양품|검.?사|불량률", query or "", re.I))


@router.post("/search")
def search_documents(body: SearchBody):
    q = body.query.strip()
    if not q:
        raise HTTPException(400, "검색어를 입력하세요.")
    return _retrieve_hits(q, body.limit)


@router.post("/ask")
def ask_documents(body: SearchBody):
    """Shift 봇: 문서(+목록·제목검색) + (관련 시) 알림·KPI + 멀티턴. 대화 DB 저장 없음."""
    from documents.alert_context import collect_alert_context
    from documents.doc_catalog import (
        collect_catalog_text,
        ensure_live_bodies,
        wants_doc_catalog,
    )
    from documents.quality_context import collect_quality_context

    q = body.query.strip()
    if not q:
        raise HTTPException(400, "검색어를 입력하세요.")
    ui = body.ui_context
    ui_dict = ui.model_dump() if ui else None
    path = (ui.path if ui else "") or ""
    hits = _retrieve_hits(q, body.limit)
    catalog_text = ""
    if wants_doc_catalog(q, path):
        catalog_text = collect_catalog_text(q)
        # 제목검색·메타만 청크 → 파일 즉시 추출 + 재청킹 예약
        hits = ensure_live_bodies(q, hits, limit=body.limit)
    alert_sources, alert_text = collect_alert_context(query=q, ui_context=ui_dict)
    if _wants_quality_kpi(q, path):
        quality_sources, quality_text = collect_quality_context()
    else:
        quality_sources, quality_text = [], ""
    doc_sources = [{**h, "kind": "company_document"} for h in hits]
    history = [m.model_dump() for m in body.history]
    try:
        answer = generate_answer(
            q,
            hits,
            alert_text=alert_text,
            quality_text=quality_text,
            ui_context_text=_ui_context_text(ui),
            catalog_text=catalog_text,
            history=history,
        )
    except Exception as e:
        log.exception("Shift Chat 실패")
        msg = str(e)
        if "API_KEY" in msg:
            raise HTTPException(503, msg) from e
        raise HTTPException(502, f"Chat 실패: {e}") from e
    return {
        "answer": answer,
        "sources": [*doc_sources, *alert_sources, *quality_sources],
    }

