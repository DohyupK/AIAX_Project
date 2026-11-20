"""사진 받기 API (FastAPI 라우터) — MS 작성, 서버 배포는 DH (2026-11-20)

POST /api/images        사진 1장 받기 (MS PC Flink image_ingest 가 보냄)
  헤더  X-API-Key: <IMAGE_API_KEY>
  본문  {"casting_id": "L1_261120_132200_15", "image_base64": "...", "image_label": "ok",
         "content_type": "image/jpeg", "original_uri": "ok_front/xxx.jpg"}
  응답  200 저장됨(같은 casting_id 는 덮어씀) / 400 값 오류·없는 casting_id / 401 키 오류 / 500 서버 오류
GET  /api/images/{casting_id}   저장된 jpg 보기 (화면용)

보호구 게이트 실시간 화면 (MJPEG, 2026-11-20 추가) — 저장하지 않고 메모리에 최신 1장만 둠
POST /api/images/gate/{gate}/frame    게이트 노트북이 박스 친 화면(jpg)을 초당 몇 장씩 보냄. 헤더 X-API-Key, 본문 = jpg 그대로
GET  /api/images/gate/{gate}/stream   웹페이지: <img src="/api/images/gate/a/stream"> 하나로 영상처럼 보임
GET  /api/images/gate/{gate}/latest.jpg  최신 1장 (영상이 안 될 때 확인용)
  ※ uvicorn 을 워커 1개로 실행해야 함 (기본값). 응답에 X-Accel-Buffering: no 를 붙여 nginx 설정은 안 바꿔도 됨

환경변수 (루트 .env): IMAGE_API_KEY (보내는 쪽 MS PC .env 와 같은 이름·같은 값),
                      IMAGE_DATABASE_URL (app_mes 계정 — mes.casting_image 쓰기), IMAGE_DIR (기본 /root/images)
DB: init 27 (image_path·image_label 칸) 을 먼저 실행해야 함
"""
from __future__ import annotations

import asyncio
import hmac
import logging
import os
import time
from pathlib import Path

import psycopg
from fastapi import APIRouter, Header, HTTPException, Request
from fastapi.responses import FileResponse, Response, StreamingResponse

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


# ---------------------------------------------------------------- 게이트 실시간 화면 (MJPEG)
GATES = {"a", "b"}
FRAME_MAX = 2 * 1024 * 1024
_frames: dict[str, tuple[float, bytes]] = {}     # 게이트 → (받은 시각, jpg)


def _gate(gate: str) -> str:
    if gate not in GATES:
        raise HTTPException(400, "게이트는 a / b")
    return gate


@router.post("/gate/{gate}/frame")
async def gate_frame(gate: str, request: Request, x_api_key: str | None = Header(default=None)) -> dict:
    _check_key(x_api_key)
    body = await request.body()
    if not body.startswith(store.JPEG_MAGIC) or len(body) > FRAME_MAX:
        raise HTTPException(400, "jpg 1장(2MB 이하)을 본문으로 보내 주세요")
    _frames[_gate(gate)] = (time.time(), body)
    return {"ok": True}


@router.get("/gate/{gate}/latest.jpg")
def gate_latest(gate: str) -> Response:
    item = _frames.get(_gate(gate))
    if item is None:
        raise HTTPException(404, "아직 받은 화면이 없습니다")
    return Response(item[1], media_type="image/jpeg", headers={"Cache-Control": "no-store"})


@router.get("/gate/{gate}/stream")
async def gate_stream(gate: str, request: Request) -> StreamingResponse:
    gate = _gate(gate)

    async def frames():
        sent_at, last_push = 0.0, 0.0
        while not await request.is_disconnected():
            item = _frames.get(gate)
            now = time.monotonic()
            # 새 화면이 오면 바로, 안 오면 2초마다 마지막 화면을 다시 보냄 (연결 유지)
            if item is not None and (item[0] != sent_at or now - last_push > 2):
                sent_at, last_push = item[0], now
                yield (b"--frame\r\nContent-Type: image/jpeg\r\nContent-Length: "
                       + str(len(item[1])).encode() + b"\r\n\r\n" + item[1] + b"\r\n")
            await asyncio.sleep(0.03)

    return StreamingResponse(frames(), media_type="multipart/x-mixed-replace; boundary=frame",
                             headers={"Cache-Control": "no-store", "X-Accel-Buffering": "no"})
