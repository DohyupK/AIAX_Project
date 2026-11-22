"""실행 진입점.

  cd DH/api
  uv run python -m aluminum_price backfill          # p.1~298 → CSV (MS 적재용)
  uv run python -m aluminum_price daily             # p.1 → org 직접 INSERT
  uv run python -m aluminum_price serve             # 조회 API :8766
"""
from __future__ import annotations

import argparse
import json
import logging
import sys

from .env_load import load_root_env


def main(argv: list[str] | None = None) -> int:
    load_root_env()
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
    )

    ap = argparse.ArgumentParser(prog="aluminum_price")
    sub = ap.add_subparsers(dest="cmd", required=True)

    p_bf = sub.add_parser("backfill", help="p.1~N → CSV (org 쓰기 없음)")
    p_bf.add_argument("--max-page", type=int, default=298)
    p_bf.add_argument("--csv", type=str, default="")

    sub.add_parser("daily", help="p.1 증분 → org.aluminum_price INSERT")

    p_sv = sub.add_parser("serve", help="조회 HTTP 서버")
    p_sv.add_argument("--port", type=int, default=0)

    args = ap.parse_args(argv)

    if args.cmd == "backfill":
        from pathlib import Path

        from . import crawl

        path = Path(args.csv) if args.csv else None
        result = crawl.backfill_to_csv(max_page=args.max_page, csv_path=path)
        print(json.dumps(result, ensure_ascii=False))
        return 0 if result.get("ok") else 1

    if args.cmd == "daily":
        from . import crawl

        try:
            result = crawl.daily_to_db()
        except Exception as e:
            logging.getLogger("dh.aluminum_price").exception("daily 실패")
            print(json.dumps({"ok": False, "error": str(e)}, ensure_ascii=False))
            return 1
        print(json.dumps(result, ensure_ascii=False))
        return 0

    if args.cmd == "serve":
        from . import server

        server.serve(port=args.port or None)
        return 0

    return 2


if __name__ == "__main__":
    sys.exit(main())
