"""임베딩 API — NIM(nvidia/nemotron-3-embed-1b) 우선, 없으면 OpenAI text-embedding-3-small."""
from __future__ import annotations

import logging
import math
from typing import Literal

from documents.llm_client import embed_dim, embed_model, get_openai_client, provider

log = logging.getLogger("jh.documents.embed")

InputType = Literal["passage", "query"]


def embed_texts(texts: list[str], *, input_type: InputType = "passage") -> list[list[float]]:
    """여러 청크 배치 임베딩. NIM은 input_type(passage/query) 필수. 빈 리스트면 []."""
    if not texts:
        return []
    client = get_openai_client()
    model = embed_model()
    dim = embed_dim()
    p = provider()
    out: list[list[float]] = []
    batch = 64
    for i in range(0, len(texts), batch):
        part = texts[i : i + batch]
        kwargs: dict = {"model": model, "input": part}
        # NIM 임베딩은 passage/query 모드 구분
        if p == "nim":
            kwargs["extra_body"] = {"input_type": input_type, "encoding_format": "float"}
        resp = client.embeddings.create(**kwargs)
        by_idx = sorted(resp.data, key=lambda d: d.index)
        for d in by_idx:
            vec = list(d.embedding)
            if len(vec) != dim:
                raise RuntimeError(f"임베딩 차원 불일치: {len(vec)} != {dim} (model={model})")
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
