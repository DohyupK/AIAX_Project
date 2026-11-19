"""LLM/임베딩 클라이언트 — NVIDIA NIM 우선, 없으면 OpenAI. 루트 .env 키만 사용."""
from __future__ import annotations

import logging
import os
from typing import Literal

from common.db import _env

log = logging.getLogger("jh.documents.llm")

NIM_BASE_URL = "https://integrate.api.nvidia.com/v1"
NIM_EMBED_MODEL = "nvidia/nemotron-3-embed-1b"
NIM_CHAT_MODEL = "meta/llama-3.1-8b-instruct"
NIM_EMBED_DIM = 2048

OA_EMBED_MODEL = "text-embedding-3-small"
OA_CHAT_MODEL = "gpt-4o-mini"
OA_EMBED_DIM = 1536

Provider = Literal["nim", "openai"]


def _read_key(name: str) -> str:
    try:
        key = os.environ.get(name) or _env(name)
    except RuntimeError:
        key = ""
    return (key or "").strip()


def nvidia_api_key() -> str:
    return _read_key("NVIDIA_API_KEY")


def openai_api_key() -> str:
    return _read_key("OPENAI_API_KEY")


def provider() -> Provider:
    """NIM 키가 있으면 nim, 아니면 openai. 둘 다 없으면 RuntimeError."""
    if nvidia_api_key():
        return "nim"
    if openai_api_key():
        return "openai"
    raise RuntimeError(
        "NVIDIA_API_KEY 또는 OPENAI_API_KEY 미설정 — 프로젝트 루트 .env 에 "
        "NVIDIA_API_KEY(우선, build.nvidia.com) 또는 OPENAI_API_KEY 를 넣고 API를 재시작하세요."
    )


def provider_name() -> str:
    return provider()


def embed_model() -> str:
    return NIM_EMBED_MODEL if provider() == "nim" else OA_EMBED_MODEL


def chat_model() -> str:
    return NIM_CHAT_MODEL if provider() == "nim" else OA_CHAT_MODEL


def embed_dim() -> int:
    return NIM_EMBED_DIM if provider() == "nim" else OA_EMBED_DIM


def get_openai_client():
    """OpenAI SDK 클라이언트 (NIM은 base_url 지정)."""
    from openai import OpenAI

    p = provider()
    if p == "nim":
        return OpenAI(api_key=nvidia_api_key(), base_url=NIM_BASE_URL)
    return OpenAI(api_key=openai_api_key())
