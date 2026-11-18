"""JH API 서버 — 실행: cd JH/api && uv run uvicorn main:app --host 127.0.0.1 --port 8000

라우터: hr (인사, app_hr) · casting (공정 mes 읽기, app_lake) · ppe (보호구 ai·lake 읽기, app_lake) · models (모델 레지스트리 ai 읽기, app_lake)
ponytail: 로그인 전이라 개인정보 API가 열려 있음 → 반드시 127.0.0.1 로만 실행 (외부 공개 금지).
루트 단일 서버로 합칠 때는 이 파일 대신 루트 진입점이 hr.router 를 include (DH 결정).
"""
import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from casting.router import router as casting_router
from hr.router import router as hr_router
from models.router import router as models_router
from ppe.router import router as ppe_router

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")

app = FastAPI(title="JH API")
app.add_middleware(
    CORSMiddleware,
    # 이 PC의 Next.js 개발 서버만 (포트는 3000이 사용 중이면 3001… 로 바뀌므로 포트 무관)
    allow_origin_regex=r"http://(localhost|127\.0\.0\.1)(:\d+)?",
    allow_methods=["GET", "POST", "PATCH", "DELETE"],
    allow_headers=["Content-Type", "X-Employee-No"],
)
app.include_router(hr_router)
app.include_router(casting_router)
app.include_router(ppe_router)
app.include_router(models_router)
