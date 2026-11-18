"""E1a 페이로드 계약 — JSON 메타 + Base64 이미지.

1차: 검증·문서화만. Kafka produce/consume 은 2차(라이브러리 승인 후).
"""
from __future__ import annotations

import base64
import re
from dataclasses import dataclass
from typing import Any

# casting_id 예: 260804_070411_1
_CASTING_ID_RE = re.compile(r"^\d{6}_\d{6}_\d+$")


@dataclass
class ImageIngestPayload:
    casting_id: str
    image_base64: str
    original_uri: str | None = None
    content_type: str = "image/jpeg"

    def to_dict(self) -> dict[str, Any]:
        return {
            "casting_id": self.casting_id,
            "original_uri": self.original_uri,
            "content_type": self.content_type,
            "image_base64": self.image_base64,
            "encoding": "E1a",
        }


def parse_ingest(data: dict[str, Any]) -> ImageIngestPayload:
    """유입 메시지 검증. 실패 시 ValueError."""
    cid = str(data.get("casting_id") or "").strip()
    if not cid or not _CASTING_ID_RE.match(cid):
        raise ValueError("casting_id 형식이 올바르지 않습니다 (예: 260804_070411_1)")

    b64 = data.get("image_base64")
    if not b64 or not isinstance(b64, str):
        raise ValueError("image_base64 가 필요합니다 (E1a)")

    # 원상복구 가능 여부만 확인 (전체를 디코드해 메모리 폭탄 방지 — 앞부분+패딩 검사)
    try:
        sample = b64[:64] + ("====" if len(b64) < 64 else "")
        base64.b64decode(sample, validate=False)
    except Exception as e:  # noqa: BLE001 — 뼈대: 형식 오류만 안내
        raise ValueError(f"image_base64 가 Base64가 아닙니다: {e}") from e

    ct = str(data.get("content_type") or "image/jpeg")
    uri = data.get("original_uri")
    uri_s = str(uri).strip() if uri else None
    return ImageIngestPayload(
        casting_id=cid,
        image_base64=b64,
        original_uri=uri_s,
        content_type=ct,
    )


# mes INSERT 용 SQL (app_mes). casting_id 는 이미 mes.investment_casting 에 있어야 함.
UPSERT_MES_SQL = """
INSERT INTO mes.casting_image (casting_id, original_uri, content_type, image_base64, updated_at, created_at)
VALUES (%s, %s, %s, %s, now(), now())
ON CONFLICT (casting_id) DO UPDATE SET
    original_uri = EXCLUDED.original_uri,
    content_type = EXCLUDED.content_type,
    image_base64 = EXCLUDED.image_base64,
    updated_at = now()
"""

# lake 복제 (app_spark) — 갱신된 최신 1건
UPSERT_LAKE_SQL = """
INSERT INTO lake.lake_casting_image (
    casting_id, original_uri, content_type, image_base64, updated_at, created_at, lake_synced_at
)
SELECT casting_id, original_uri, content_type, image_base64, updated_at, created_at, now()
FROM mes.casting_image
WHERE casting_id = %s
ON CONFLICT (casting_id) DO UPDATE SET
    original_uri = EXCLUDED.original_uri,
    content_type = EXCLUDED.content_type,
    image_base64 = EXCLUDED.image_base64,
    updated_at = EXCLUDED.updated_at,
    created_at = EXCLUDED.created_at,
    lake_synced_at = now()
"""
