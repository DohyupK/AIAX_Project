"""전 문서 재청킹·재임베딩 큐 (NIM 전환·제목 메타 접두 반영 시).

  cwd=JH/api 에서:
    uv run python -m documents.requeue_all

서버 .env 에 NVIDIA_API_KEY(또는 OPENAI) 넣고 API 프로세스와 같은 환경에서 실행.
"""
from __future__ import annotations

from documents.jobs import requeue_all_for_reembed
from documents.llm_client import embed_model, provider_name


def main() -> None:
    print(f"provider={provider_name()} model={embed_model()}")
    result = requeue_all_for_reembed()
    print(result)


if __name__ == "__main__":
    main()
