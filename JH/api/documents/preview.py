"""문서 내용 보기 — docx·xlsx·pptx 를 LibreOffice(headless)로 PDF 변환해 원본 모양으로 보여 줌.

- 변환 결과는 DOCUMENT_ROOT/_preview/<문서번호>.pdf 에 저장해 재사용 (원본이 더 새로우면 다시 변환), 문서 삭제 시 함께 삭제
- LibreOffice 가 없으면 None → 화면은 본문 텍스트(/text)로 대신 보여 줌
- 설치: 서버에서 bash JH/api/documents/install_office_convert.sh (승인 요청서 JH/전달사항/2026-11-20_LibreOffice_승인요청.md)
"""
from __future__ import annotations

import logging
import shutil
import subprocess
import tempfile
import threading
from pathlib import Path

from documents.paths import document_root, ext_of

log = logging.getLogger("jh.documents.preview")
CONVERT_EXT = frozenset({"docx", "xlsx", "pptx"})
TIMEOUT_SEC = 90
_lock = threading.Lock()   # LibreOffice 는 같은 프로필로 동시에 여러 개 못 돌림 → 한 번에 하나씩


def soffice() -> str | None:
    """LibreOffice 실행 파일 (없으면 None)"""
    return shutil.which("soffice") or shutil.which("libreoffice")


def cache_path(doc_idx: int) -> Path:
    return document_root() / "_preview" / f"{doc_idx}.pdf"


def converted_pdf(doc_idx: int, src: Path, file_name: str) -> Path | None:
    """변환된 PDF 경로. 변환 대상이 아니거나 LibreOffice 가 없으면 None, 변환 실패는 예외"""
    if ext_of(file_name) not in CONVERT_EXT:
        return None
    out = cache_path(doc_idx)
    if out.is_file() and out.stat().st_mtime >= src.stat().st_mtime:
        return out
    exe = soffice()
    if not exe:
        return None
    out.parent.mkdir(parents=True, exist_ok=True)
    with _lock, tempfile.TemporaryDirectory() as tmp:
        tmpdir = Path(tmp)
        # 파일 이름에 한글·공백이 있어도 되게 임시 이름으로 복사 후 변환, 프로필도 임시 폴더 (서버 사용자 프로필 잠금 방지)
        work = tmpdir / f"doc.{ext_of(file_name)}"
        shutil.copyfile(src, work)
        cmd = [exe, f"-env:UserInstallation={(tmpdir / 'profile').as_uri()}", "--headless", "--norestore",
               "--convert-to", "pdf", "--outdir", str(tmpdir), str(work)]
        try:
            run = subprocess.run(cmd, capture_output=True, timeout=TIMEOUT_SEC, check=False)
        except subprocess.TimeoutExpired as e:
            raise RuntimeError(f"변환 시간 초과 ({TIMEOUT_SEC}초)") from e
        pdf = tmpdir / "doc.pdf"
        if run.returncode != 0 or not pdf.is_file():
            raise RuntimeError(f"변환 실패 (코드 {run.returncode}): {run.stderr.decode(errors='replace')[-300:]}")
        shutil.move(str(pdf), out)
    log.info("문서 PDF 변환 완료 doc=%s (%s)", doc_idx, file_name)
    return out


def remove_cache(doc_idx: int) -> None:
    """문서 삭제 시 변환본도 삭제"""
    try:
        cache_path(doc_idx).unlink(missing_ok=True)
    except OSError:
        log.warning("변환본 삭제 실패 doc=%s", doc_idx)
