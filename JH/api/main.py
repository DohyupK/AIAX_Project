"""JH API 서버 — 실행: cd JH/api && uv run uvicorn main:app --host 127.0.0.1 --port 8000

라우터: hr · casting · ppe · models · report · documents (사내 문서함, app_docs)
ponytail: 로그인 전이라 개인정보 API가 열려 있음 → 반드시 127.0.0.1 로만 실행 (외부 공개 금지).
루트 단일 서버로 합칠 때는 이 파일 대신 루트 진입점이 hr.router 를 include (DH 결정).
"""
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from casting import dl_model
from casting.router import router as casting_router
from documents.router import router as documents_router
from hr.router import router as hr_router
from models.router import router as models_router
from ppe.router import router as ppe_router
from report.router import router as report_router

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")

@asynccontextmanager
async def lifespan(_app: FastAPI):
    dl_model.start_worker()   # 품질 2차(DL) 판정 백그라운드 작업 — 화면 API 는 저장된 결과만 읽음
    yield


app = FastAPI(title="JH API", lifespan=lifespan)
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
app.include_router(report_router)
app.include_router(documents_router)
