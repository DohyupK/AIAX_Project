"""사진 받기 API 단독 실행용 — 실행: cd MS/image_api && uv run uvicorn main:app --host 127.0.0.1 --port 8010
기존 JH API(main.py)에 합칠 때는 이 파일 대신 그쪽에서 router 를 include (DH 결정)
"""
import logging

from fastapi import FastAPI

from router import router

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
app = FastAPI(title="AIAX image API")
app.include_router(router)
