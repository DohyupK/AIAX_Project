"""문서 파일 루트 — 루트 .env 의 DOCUMENT_ROOT (서버 확정: /root/document)."""
from __future__ import annotations

import os
import re
from pathlib import Path

from common.db import _env

ALLOWED_EXT = frozenset(
    {"pdf", "docx", "xlsx", "pptx", "hwp", "hwpx", "txt", "md", "png", "jpg", "jpeg", "zip"}
)
# 텍스트 추출 대상 (이미지·zip·미지원 hwp는 빈 문자열 → 청크 0)
EXTRACT_EXT = frozenset({"txt", "md", "pdf", "docx", "xlsx", "pptx", "hwp", "hwpx"})
MAX_FILE_BYTES = 20 * 1024 * 1024
CHUNK_CHARS = 1000
CHUNK_OVERLAP = 100  # 10% 이어쓰기
# 임베딩 모델·차원: documents.llm_client.embed_model() / embed_dim()
JOB_TIMEOUT_SEC = 120  # 백그라운드 청킹 상한 2분


def document_root() -> Path:
    raw = os.environ.get("DOCUMENT_ROOT") or _env("DOCUMENT_ROOT")
    root = Path(raw).expanduser().resolve()
    root.mkdir(parents=True, exist_ok=True)
    (root / "files").mkdir(parents=True, exist_ok=True)
    return root


def ext_of(name: str) -> str:
    i = name.rfind(".")
    return name[i + 1 :].lower() if i > 0 else ""


def safe_file_name(name: str) -> str:
    base = Path(name).name
    return re.sub(r"[^\w.\-()+\uac00-\ud7a3]", "_", base)[:180] or "file"


def file_path_for(doc_idx: int, original_name: str) -> Path:
    return document_root() / "files" / f"{doc_idx}__{safe_file_name(original_name)}"
