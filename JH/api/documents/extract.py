"""확장자별 텍스트 추출 — 청킹(BG)·문서 내용 보기(/text)에서 호출. OCR 없음. hwp(바이너리)는 빈 문자열."""
from __future__ import annotations

import logging
import re
import zipfile
from pathlib import Path
from xml.etree import ElementTree

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
        if ext == "hwpx":
            return _hwpx(path)
        if ext == "hwp":
            # ponytail: 바이너리 hwp(OLE)는 olefile 승인 후 추출 (JH/전달사항/2026-11-20_LibreOffice_승인요청.md) — 그 전엔 빈 텍스트
            log.info("hwp 추출기 없음 → 빈 텍스트: %s", file_name)
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


def _hwpx(path: Path) -> str:
    """hwpx = zip 안 Contents/section*.xml — 문단(p) 바로 아래 글자(run/t)만 이어 붙임 (표 안 문단은 따로 잡혀 중복 없음). 표준 라이브러리만"""
    local = lambda el: el.tag.rsplit("}", 1)[-1]
    lines: list[str] = []
    with zipfile.ZipFile(path) as z:
        sections = sorted((n for n in z.namelist() if re.fullmatch(r"Contents/section\d+\.xml", n)),
                          key=lambda n: int(re.search(r"\d+", n).group()))
        for name in sections:
            for p in ElementTree.fromstring(z.read(name)).iter():
                if local(p) != "p":
                    continue
                text = "".join(t.text or "" for run in p if local(run) == "run" for t in run if local(t) == "t")
                if text.strip():
                    lines.append(text)
    return "\n".join(lines)
