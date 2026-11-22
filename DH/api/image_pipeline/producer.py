"""E1a 메시지를 aiax.image.ingest 에 publish.

실행 (DH/api):
  uv run python -m image_pipeline.producer --casting-id 260804_070411_1 --base64 AQID
  echo '{"casting_id":"...","image_base64":"..."}' | uv run python -m image_pipeline.producer --stdin
"""
from __future__ import annotations

import argparse
import json
import logging
import sys

from . import config
from .env_load import load_root_env
from .kafka_io import publish_json
from .payload import parse_ingest

log = logging.getLogger("dh.image_pipeline.producer")


def publish_ingest(raw: dict) -> dict:
    """검증 후 ingest 토픽에 publish. 반환: 요약(본문 Base64 제외)."""
    load_root_env()
    payload = parse_ingest(raw)
    body = payload.to_dict()
    publish_json(config.TOPIC_INGEST, body, key=payload.casting_id)
    return {
        "ok": True,
        "topic": config.TOPIC_INGEST,
        "casting_id": payload.casting_id,
        "content_type": payload.content_type,
        "image_base64_len": len(payload.image_base64),
        "original_uri": payload.original_uri,
    }


def main(argv: list[str] | None = None) -> int:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
    p = argparse.ArgumentParser(description="DH image ingest producer (E1a)")
    p.add_argument("--stdin", action="store_true", help="stdin JSON 1건")
    p.add_argument("--casting-id", default="")
    p.add_argument("--base64", default="", help="image_base64")
    p.add_argument("--content-type", default="image/jpeg")
    p.add_argument("--original-uri", default="")
    args = p.parse_args(argv)

    if args.stdin:
        raw = json.loads(sys.stdin.read() or "{}")
    else:
        if not args.casting_id or not args.base64:
            p.error("--stdin 또는 --casting-id 와 --base64 필요")
        raw = {
            "casting_id": args.casting_id,
            "image_base64": args.base64,
            "content_type": args.content_type,
        }
        if args.original_uri:
            raw["original_uri"] = args.original_uri

    result = publish_ingest(raw)
    print(json.dumps(result, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
