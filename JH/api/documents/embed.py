"""OpenAI Embeddings API. 키는 루트 .env OPENAI_API_KEY (혜진봇 Chat과 공용)."""
from __future__ import annotations

import logging
import math
import os

from common.db import _env
from documents.paths import EMBED_DIM, EMBED_MODEL

log = logging.getLogger("jh.documents.embed")


def _api_key() -> str:
    try:
        key = os.environ.get("OPENAI_API_KEY") or _env("OPENAI_API_KEY")
    except RuntimeError:
        key = ""
    key = (key or "").strip()
    if not key:
        raise RuntimeError(
            "OPENAI_API_KEY 미설정 — 프로젝트 루트 .env 에 "
            "OPENAI_API_KEY=sk-... 를 넣고 API를 재시작하세요. "
            "(https://platform.openai.com/api-keys , Embeddings·혜진봇 Chat 공용)"
        )
    return key


def embed_texts(texts: list[str]) -> list[list[float]]:
    """여러 청크를 배치 임베딩. 빈 리스트면 []."""
    if not texts:
        return []
    from openai import OpenAI

    client = OpenAI(api_key=_api_key())
    # API 입력 길이 제한 대비 — 청크는 800자라 배치만 나눔
    out: list[list[float]] = []
    batch = 64
    for i in range(0, len(texts), batch):
        part = texts[i : i + batch]
        resp = client.embeddings.create(model=EMBED_MODEL, input=part)
        # index 순으로 정렬
        by_idx = sorted(resp.data, key=lambda d: d.index)
        for d in by_idx:
            vec = list(d.embedding)
            if len(vec) != EMBED_DIM:
                raise RuntimeError(f"임베딩 차원 불일치: {len(vec)} != {EMBED_DIM}")
            out.append(vec)
    return out


def cosine(a: list[float], b: list[float]) -> float:
    if len(a) != len(b):
        return -1.0
    dot = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a))
    nb = math.sqrt(sum(y * y for y in b))
    if na == 0 or nb == 0:
        return -1.0
    return dot / (na * nb)
