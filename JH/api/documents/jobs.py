"""청킹·임베딩 잡 — 예외 사다리: 즉시 2회 → 5분 후 1회 → midnight_pending (00시 Spark)."""
from __future__ import annotations

import logging
import threading
import time
from pathlib import Path

from common.db import connect
from documents.chunk import split_text
from documents.embed import embed_texts
from documents.extract import extract_text
from documents.llm_client import embed_model
from documents.paths import JOB_TIMEOUT_SEC, file_path_for

log = logging.getLogger("jh.documents.jobs")
DB = "DOCS_DATABASE_URL"


def set_job_status(doc_idx: int, status: str, attempt: int, err: str | None = None) -> None:
    with connect(DB) as conn:
        conn.execute(
            """
            INSERT INTO org.document_chunk_job (company_document_idx, chunk_status, attempt_count, last_error, updated_at)
            VALUES (%s, %s, %s, %s, now())
            ON CONFLICT (company_document_idx) DO UPDATE SET
              chunk_status = EXCLUDED.chunk_status,
              attempt_count = EXCLUDED.attempt_count,
              last_error = EXCLUDED.last_error,
              updated_at = now()
            """,
            [doc_idx, status, attempt, err],
        )


def _next_ids(conn, table: str, pk: str, n: int) -> list[int]:
    row = conn.execute(f"SELECT COALESCE(MAX({pk}), 0) AS m FROM {table}").fetchone()
    start = int(row["m"]) + 1
    return list(range(start, start + n))


def _meta_prefix(title: str, file_name: str, category: str | None) -> str:
    """임베딩용 제목·파일·분류 접두 (검색에 제목이 반영되도록)."""
    lines = [
        f"제목: {(title or '').strip() or '(제목 없음)'}",
        f"파일: {(file_name or '').strip() or '(파일명 없음)'}",
    ]
    cat = (category or "").strip()
    if cat:
        lines.append(f"분류: {cat}")
    return "\n".join(lines)


def run_chunk_once(doc_idx: int) -> None:
    """한 번 시도: 추출→청크→DB→임베딩(제목 메타 접두). 본문 없으면 메타 1청크."""
    with connect(DB) as conn:
        doc = conn.execute(
            """
            SELECT company_document_idx, file_path, file_name, title, category
            FROM org.company_document WHERE company_document_idx = %s
            """,
            [doc_idx],
        ).fetchone()
        if not doc:
            raise RuntimeError(f"문서 없음: {doc_idx}")
        path = Path(doc["file_path"])
        if not path.is_file():
            # DOCUMENT_ROOT 기준 재구성
            alt = file_path_for(doc_idx, doc["file_name"])
            path = alt if alt.is_file() else path
        if not path.is_file():
            raise RuntimeError(f"파일 없음: {path}")

        # 기존 청크 삭제 후 재생성 (재시도 시)
        conn.execute(
            "DELETE FROM org.document_chunk WHERE company_document_idx = %s",
            [doc_idx],
        )

    t0 = time.monotonic()
    text = extract_text(path, doc["file_name"])
    if time.monotonic() - t0 > JOB_TIMEOUT_SEC:
        raise TimeoutError("청킹 2분 초과 (추출)")

    parts = split_text(text)
    if time.monotonic() - t0 > JOB_TIMEOUT_SEC:
        raise TimeoutError("청킹 2분 초과 (분할)")

    prefix = _meta_prefix(doc.get("title") or "", doc["file_name"], doc.get("category"))
    # 본문 없으면 메타만 1청크(이미지 등) — DB content에도 메타 저장
    if not parts:
        parts = [prefix]
        embed_inputs = [prefix]
        log.info("문서 %s 본문 없음 → 제목 메타 1청크", doc_idx)
    else:
        # DB에는 본문만, 임베딩 입력에만 제목 접두
        embed_inputs = [f"{prefix}\n\n{p}" for p in parts]

    with connect(DB) as conn:
        ids = _next_ids(conn, "org.document_chunk", "document_chunk_idx", len(parts))
        # Connection.executemany 미지원 환경 대비 — execute 루프
        for i, (cid, content) in enumerate(zip(ids, parts), start=1):
            conn.execute(
                """
                INSERT INTO org.document_chunk (document_chunk_idx, company_document_idx, chunk_no, content)
                VALUES (%s, %s, %s, %s)
                """,
                [cid, doc_idx, i, content],
            )

    vectors = embed_texts(embed_inputs, input_type="passage")
    if time.monotonic() - t0 > JOB_TIMEOUT_SEC:
        raise TimeoutError("청킹 2분 초과 (임베딩)")

    model_name = embed_model()
    with connect(DB) as conn:
        eids = _next_ids(conn, "org.document_chunk_embedding", "document_chunk_embedding_idx", len(ids))
        for eid, cid, vec in zip(eids, ids, vectors):
            conn.execute(
                """
                INSERT INTO org.document_chunk_embedding
                  (document_chunk_embedding_idx, document_chunk_idx, embedding, model_name)
                VALUES (%s, %s, %s::real[], %s)
                """,
                [eid, cid, vec, model_name],
            )

    set_job_status(doc_idx, "ok", 0, None)
    log.info("문서 %s 청크 %d건·임베딩 완료 (제목 메타 접두)", doc_idx, len(parts))


def _try_twice(doc_idx: int) -> bool:
    last: Exception | None = None
    for attempt in range(1, 3):
        try:
            run_chunk_once(doc_idx)
            return True
        except Exception as e:
            last = e
            log.exception("문서 %s 청킹 시도 %d/2 실패", doc_idx, attempt)
            set_job_status(doc_idx, "pending", attempt, str(e)[:500])
            time.sleep(0.5)
    assert last is not None
    set_job_status(doc_idx, "retry_5m", 2, str(last)[:500])
    return False


def schedule_chunk_job(doc_idx: int) -> None:
    """업로드 직후 호출 — 백그라운드 스레드."""
    set_job_status(doc_idx, "pending", 0, None)

    def worker() -> None:
        if _try_twice(doc_idx):
            return
        log.warning("문서 %s — 5분 후 재시도 예약", doc_idx)
        time.sleep(300)
        try:
            run_chunk_once(doc_idx)
            return
        except Exception as e:
            log.exception("문서 %s 5분 후 재시도 실패 → midnight_pending", doc_idx)
            set_job_status(doc_idx, "midnight_pending", 3, str(e)[:500])

    threading.Thread(target=worker, name=f"doc-chunk-{doc_idx}", daemon=True).start()


def rechunk_midnight_pending() -> dict:
    """00시 Spark/실행기가 호출 — midnight_pending 문서 재처리."""
    with connect(DB) as conn:
        rows = conn.execute(
            """
            SELECT company_document_idx FROM org.document_chunk_job
            WHERE chunk_status IN ('midnight_pending', 'retry_5m', 'pending')
            ORDER BY company_document_idx
            """
        ).fetchall()
    ok, fail = 0, 0
    for r in rows:
        idx = int(r["company_document_idx"])
        try:
            run_chunk_once(idx)
            ok += 1
        except Exception as e:
            fail += 1
            set_job_status(idx, "midnight_pending", 4, str(e)[:500])
            log.exception("자정 재청킹 실패 doc=%s", idx)
    return {"ok": ok, "fail": fail, "total": len(rows)}


def requeue_all_for_reembed() -> dict:
    """NIM/모델 전환 후 — 전 문서 순차 재청킹·재임베딩 (CLI용, 스레드 종료 방지)."""
    with connect(DB) as conn:
        rows = conn.execute(
            "SELECT company_document_idx FROM org.company_document ORDER BY company_document_idx"
        ).fetchall()
    ids = [int(r["company_document_idx"]) for r in rows]
    ok, fail = 0, 0
    for idx in ids:
        set_job_status(idx, "pending", 0, None)
        try:
            run_chunk_once(idx)
            ok += 1
        except Exception as e:
            fail += 1
            set_job_status(idx, "midnight_pending", 1, str(e)[:500])
            log.exception("재임베딩 실패 doc=%s", idx)
    log.info(
        "전 문서 재임베딩 완료 ok=%d fail=%d model=%s",
        ok,
        fail,
        embed_model(),
    )
    return {"ok": ok, "fail": fail, "total": len(ids), "model": embed_model()}


def _chunk_is_meta_only(content: str) -> bool:
    c = (content or "").strip()
    if not c:
        return True
    lines = [ln for ln in c.splitlines() if ln.strip()]
    if len(lines) <= 3 and all(
        ln.startswith("제목:") or ln.startswith("파일:") or ln.startswith("분류:") for ln in lines
    ):
        return True
    return c.startswith("제목:") and "\n\n" not in c and len(c) < 400


def find_meta_or_empty_doc_ids() -> list[int]:
    """청크 없음·메타만·청킹 실패 상태 문서 idx."""
    with connect(DB) as conn:
        docs = conn.execute(
            "SELECT company_document_idx FROM org.company_document ORDER BY company_document_idx"
        ).fetchall()
        out: list[int] = []
        for r in docs:
            idx = int(r["company_document_idx"])
            job = conn.execute(
                "SELECT chunk_status FROM org.document_chunk_job WHERE company_document_idx = %s",
                [idx],
            ).fetchone()
            st = (job["chunk_status"] if job else None) or ""
            if st in ("pending", "retry_5m", "midnight_pending", ""):
                out.append(idx)
                continue
            chunks = conn.execute(
                "SELECT content FROM org.document_chunk WHERE company_document_idx = %s ORDER BY chunk_no",
                [idx],
            ).fetchall()
            if not chunks:
                out.append(idx)
                continue
            if all(_chunk_is_meta_only(c.get("content") or "") for c in chunks):
                out.append(idx)
        return out


def requeue_meta_only_for_reembed() -> dict:
    """메타만/빈 청크 문서만 본문 재추출 + NIM 임베딩 (토큰 절약)."""
    ids = find_meta_or_empty_doc_ids()
    ok, fail = 0, 0
    for idx in ids:
        set_job_status(idx, "pending", 0, None)
        try:
            run_chunk_once(idx)
            ok += 1
        except Exception as e:
            fail += 1
            set_job_status(idx, "midnight_pending", 1, str(e)[:500])
            log.exception("메타문서 재청킹 실패 doc=%s", idx)
    log.info(
        "메타/빈 청크 재임베딩 ok=%d fail=%d total=%d model=%s",
        ok,
        fail,
        len(ids),
        embed_model(),
    )
    return {"ok": ok, "fail": fail, "total": len(ids), "ids": ids, "model": embed_model()}
