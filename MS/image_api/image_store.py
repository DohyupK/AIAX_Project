"""사진 받기 API 의 핵심 처리 — FastAPI 없이도 시험할 수 있게 분리 (2026-11-20, MS)

받은 JSON 검사 → base64 를 jpg 로 풀기 → /root/images/L{라인}/{yymmdd}/{casting_id}.jpg 저장 → mes.casting_image 기록
같은 casting_id 를 다시 받으면 파일·기록을 덮어씀 (보내는 쪽 재전송 대비)
"""
from __future__ import annotations

import base64
import binascii
import os
import re
from dataclasses import dataclass
from pathlib import Path

CASTING_ID_RE = re.compile(r"^L(\d+)_(\d{6})_\d{6}_\d+$")   # L라인번호_yymmdd_hhmmss_생산번호
LABELS = {"ok", "defect"}
MAX_BYTES = 5 * 1024 * 1024        # 사진 1장 최대 5MB (지금 사진은 약 25KB)
JPEG_MAGIC = b"\xff\xd8\xff"

UPSERT_SQL = """
INSERT INTO mes.casting_image (casting_id, original_uri, content_type, image_base64, image_path, image_label, updated_at, created_at)
VALUES (%s, %s, %s, %s, %s, %s, now(), now())
ON CONFLICT (casting_id) DO UPDATE SET
    original_uri = EXCLUDED.original_uri,
    content_type = EXCLUDED.content_type,
    image_base64 = EXCLUDED.image_base64,
    image_path   = EXCLUDED.image_path,
    image_label  = EXCLUDED.image_label,
    updated_at   = now()
"""


class BadRequest(ValueError):
    """보낸 값이 잘못됨 → 400 (보내는 쪽은 건너뜀)"""


@dataclass
class ImageIn:
    casting_id: str
    image_base64: str
    jpg: bytes
    image_label: str | None
    content_type: str
    original_uri: str | None


def image_dir() -> Path:
    return Path(os.environ.get("IMAGE_DIR", "/root/images"))


def parse(data: object) -> ImageIn:
    if not isinstance(data, dict):
        raise BadRequest("JSON object 가 필요합니다")
    cid = str(data.get("casting_id") or "").strip()
    if not CASTING_ID_RE.match(cid):
        raise BadRequest("casting_id 형식 오류 (예: L1_261120_132200_15)")
    b64 = data.get("image_base64")
    if not isinstance(b64, str) or not b64:
        raise BadRequest("image_base64 가 필요합니다")
    if len(b64) > MAX_BYTES * 4 // 3 + 4:
        raise BadRequest("사진이 너무 큽니다 (최대 5MB)")
    try:
        jpg = base64.b64decode(b64, validate=True)
    except (binascii.Error, ValueError) as e:
        raise BadRequest("image_base64 가 base64 가 아닙니다") from e
    if not jpg.startswith(JPEG_MAGIC):
        raise BadRequest("jpg 사진이 아닙니다")
    label = data.get("image_label")
    label = str(label).strip().lower() if label else None
    if label is not None and label not in LABELS:
        raise BadRequest("image_label 은 ok / defect 만 가능")
    uri = data.get("original_uri")
    return ImageIn(cid, b64, jpg, label, str(data.get("content_type") or "image/jpeg"),
                   str(uri).strip() if uri else None)


def decode_jpeg(b64: object) -> bytes:
    """base64 문자열 → jpg 바이트 (크기·형식 검사). 잘못되면 BadRequest"""
    if not isinstance(b64, str) or not b64:
        raise BadRequest("image_base64 가 필요합니다")
    if len(b64) > MAX_BYTES * 4 // 3 + 4:
        raise BadRequest("사진이 너무 큽니다 (최대 5MB)")
    try:
        jpg = base64.b64decode(b64, validate=True)
    except (binascii.Error, ValueError) as e:
        raise BadRequest("image_base64 가 base64 가 아닙니다") from e
    if not jpg.startswith(JPEG_MAGIC):
        raise BadRequest("jpg 사진이 아닙니다")
    return jpg


def file_path(casting_id: str, root: Path | None = None) -> Path:
    """L1_261120_132200_15 → /root/images/L1/261120/L1_261120_132200_15.jpg"""
    m = CASTING_ID_RE.match(casting_id)
    if not m:
        raise BadRequest("casting_id 형식 오류")
    return (root or image_dir()) / f"L{m.group(1)}" / m.group(2) / f"{casting_id}.jpg"


def save_file(img: ImageIn, root: Path | None = None) -> Path:
    """임시 파일에 쓴 뒤 이름 바꾸기 — 쓰다 끊겨도 반쪽 사진이 남지 않음. 같은 이름이면 덮어씀"""
    path = file_path(img.casting_id, root)
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".jpg.tmp")
    tmp.write_bytes(img.jpg)
    os.replace(tmp, path)
    return path


def save_db(conn, img: ImageIn, path: Path) -> None:
    """mes.casting_image 기록 (psycopg 연결). 없는 casting_id 면 FK 오류 → 호출한 쪽에서 400"""
    conn.execute(UPSERT_SQL, (img.casting_id, img.original_uri, img.content_type,
                              img.image_base64, str(path), img.image_label))
