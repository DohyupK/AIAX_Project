"""메타만·빈 청크 문서 재청킹·NIM 임베딩.

  cwd=JH/api:
    uv run python -m documents.requeue_meta
"""
from __future__ import annotations

from documents.jobs import requeue_meta_only_for_reembed
from documents.llm_client import embed_model, provider_name


def main() -> None:
    print(f"provider={provider_name()} model={embed_model()}")
    result = requeue_meta_only_for_reembed()
    print(result)


if __name__ == "__main__":
    main()
