"""자정(00:00 KST) Spark/lake_runner 연동용 — midnight_pending 문서 재청킹.

실행 (JH/api):
  uv run python -m documents.rechunk

MS lake_runner 에 이 명령을 같은 시각에 붙이도록 전달사항 참고.
"""
from __future__ import annotations

import json
import logging
import sys

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")

from documents.jobs import rechunk_midnight_pending  # noqa: E402


def main() -> int:
    result = rechunk_midnight_pending()
    print(json.dumps(result, ensure_ascii=False))
    return 0 if result.get("fail", 0) == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
