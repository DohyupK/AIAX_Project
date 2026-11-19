"""확장자별 텍스트 추출 — 필터 통과 후 BG에서 호출. OCR 없음. hwp는 실패 시 빈 문자열."""
from __future__ import annotations

import logging
from pathlib import Path

from documents.paths import EXTRACT_EXT, ext_of

log = logging.getLogger("jh.documents.extract")


def extract_text(path: Path, file_name: str) -> str:
    ext = ext_of(file_name)
    if ext not in EXTRACT_EXT:
        return ""
    try:
        if ext == "txt":
            return path.read_text(encoding="utf-8", errors="replace")
        if ext == "pdf":
            return _pdf(path)
        if ext == "docx":
            return _docx(path)
        if ext == "xlsx":
            return _xlsx(path)
        if ext == "pptx":
            return _pptx(path)
        if ext in ("hwp", "hwpx"):
            # ponytail: 안정 추출기 미도입 — 허용 확장자만, 청크는 0 가능
            log.info("hwp/hwpx 추출기 없음 → 빈 텍스트: %s", file_name)
            return ""
    except Exception:
        log.exception("텍스트 추출 실패: %s", file_name)
        raise
    return ""


def _pdf(path: Path) -> str:
    from pypdf import PdfReader

    reader = PdfReader(str(path))
    parts: list[str] = []
    for page in reader.pages:
        parts.append(page.extract_text() or "")
    return "\n".join(parts)


def _docx(path: Path) -> str:
    from docx import Document

    doc = Document(str(path))
    return "\n".join(p.text for p in doc.paragraphs if p.text)


def _xlsx(path: Path) -> str:
    from openpyxl import load_workbook

    wb = load_workbook(str(path), read_only=True, data_only=True)
    lines: list[str] = []
    try:
        for ws in wb.worksheets:
            for row in ws.iter_rows(values_only=True):
                cells = [str(c) for c in row if c is not None and str(c).strip()]
                if cells:
                    lines.append("\t".join(cells))
    finally:
        wb.close()
    return "\n".join(lines)


def _pptx(path: Path) -> str:
    from pptx import Presentation

    prs = Presentation(str(path))
    lines: list[str] = []
    for slide in prs.slides:
        for shape in slide.shapes:
            if hasattr(shape, "text") and shape.text:
                lines.append(shape.text)
    return "\n".join(lines)
