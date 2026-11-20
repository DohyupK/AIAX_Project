"""사진 받기 API (FastAPI 라우터) — MS 작성, 서버 배포는 DH (2026-11-20)

POST /api/images        사진 1장 받기 (MS PC Flink image_ingest 가 보냄)
  헤더  X-API-Key: <IMAGE_API_KEY>
  본문  {"casting_id": "L1_261120_132200_15", "image_base64": "...", "image_label": "ok",
         "content_type": "image/jpeg", "original_uri": "ok_front/xxx.jpg"}
  응답  200 저장됨(같은 casting_id 는 덮어씀) / 400 값 오류·없는 casting_id / 401 키 오류 / 500 서버 오류
GET  /api/images/{casting_id}   저장된 jpg 보기 (화면용)

환경변수 (루트 .env): IMAGE_API_KEY (보내는 쪽 MS PC .env 와 같은 이름·같은 값),
                      IMAGE_DATABASE_URL (app_mes 계정 — mes.casting_image 쓰기), IMAGE_DIR (기본 /root/images)
DB: init 27 (image_path·image_label 칸) 을 먼저 실행해야 함
"""
from __future__ import annotations

import hmac
import logging
import os
from pathlib import Path

import psycopg
from fastapi import APIRouter, Header, HTTPException, Request
from fastapi.responses import FileResponse

import image_store as store

log = logging.getLogger("image_api")
router = APIRouter(prefix="/api/images", tags=["images"])
ROOT_ENV = Path(__file__).resolve().parents[2] / ".env"   # MS/image_api/router.py → 프로젝트 루트


def _env(key: str, default: str | None = None) -> str:
    if os.environ.get(key):
        return os.environ[key]
    if ROOT_ENV.exists():
        for line in ROOT_ENV.read_text(encoding="utf-8").splitlines():
            if "=" in line and not line.strip().startswith("#"):
                k, v = line.split("=", 1)
                if k.strip() == key and v.strip():
                    return v.strip().strip('"')
    if default is not None:
        return default
    raise RuntimeError(f"루트 .env 에 {key} 가 없습니다")


def _check_key(given: str | None) -> None:
    want = _env("IMAGE_API_KEY", "")
    if not want:   # 키를 안 정해 두면 아무도 못 올림 (열어 두지 않음)
        raise HTTPException(500, "서버에 IMAGE_API_KEY 가 설정되지 않았습니다")
    if not given or not hmac.compare_digest(given, want):
        raise HTTPException(401, "API 키가 틀렸습니다")


@router.post("")
async def upload(request: Request, x_api_key: str | None = Header(default=None)) -> dict:
    _check_key(x_api_key)
    try:
        img = store.parse(await request.json())
    except store.BadRequest as e:
        raise HTTPException(400, str(e)) from e
    except ValueError as e:   # JSON 아님
        raise HTTPException(400, "JSON 이 아닙니다") from e

    root = Path(_env("IMAGE_DIR", "/root/images"))
    path = store.save_file(img, root)
    try:
        with psycopg.connect(_env("IMAGE_DATABASE_URL"), connect_timeout=10) as conn:
            store.save_db(conn, img, path)
    except psycopg.errors.ForeignKeyViolation as e:   # mes.investment_casting 에 없는 샷
        path.unlink(missing_ok=True)
        raise HTTPException(400, f"없는 casting_id: {img.casting_id}") from e
    except psycopg.errors.CheckViolation as e:
        path.unlink(missing_ok=True)
        raise HTTPException(400, "값이 DB 규칙에 맞지 않습니다") from e
    log.info("사진 저장 %s (%s, %d bytes)", path, img.image_label, len(img.jpg))
    return {"casting_id": img.casting_id, "image_path": str(path), "image_label": img.image_label}


@router.get("/{casting_id}")
def view(casting_id: str) -> FileResponse:
    try:
        path = store.file_path(casting_id, Path(_env("IMAGE_DIR", "/root/images")))
    except store.BadRequest as e:
        raise HTTPException(400, str(e)) from e
    if not path.is_file():
        raise HTTPException(404, "사진이 없습니다")
    return FileResponse(path, media_type="image/jpeg")
