"""줄바꿈 우선 + 최대 1000자 청크 (overlap 100 = 10%)."""
from __future__ import annotations

from documents.paths import CHUNK_CHARS, CHUNK_OVERLAP


def split_text(text: str, max_chars: int = CHUNK_CHARS, overlap: int = CHUNK_OVERLAP) -> list[str]:
    text = (text or "").replace("\r\n", "\n").replace("\r", "\n").strip()
    if not text:
        return []
    # 줄 단위로 모으다가 max 넘기면 자름
    lines = text.split("\n")
    chunks: list[str] = []
    buf = ""
    for line in lines:
        line = line.strip()
        if not line:
            if buf:
                chunks.extend(_flush(buf, max_chars, overlap))
                buf = ""
            continue
        candidate = f"{buf}\n{line}".strip() if buf else line
        if len(candidate) <= max_chars:
            buf = candidate
        else:
            if buf:
                chunks.extend(_flush(buf, max_chars, overlap))
            buf = line
    if buf:
        chunks.extend(_flush(buf, max_chars, overlap))
    return [c for c in chunks if c.strip()]


def _flush(block: str, max_chars: int, overlap: int) -> list[str]:
    if len(block) <= max_chars:
        return [block]
    out: list[str] = []
    start = 0
    n = len(block)
    while start < n:
        end = min(start + max_chars, n)
        out.append(block[start:end].strip())
        if end >= n:
            break
        start = max(end - overlap, start + 1)
    return [c for c in out if c]
