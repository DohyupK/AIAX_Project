"""DB 연결 — 비밀은 프로젝트 루트 .env 만 사용 (AGENTS.md 5항)

요청마다 연결을 열고 반드시 닫음 (with 블록) — 커넥션 누수 방지.
ponytail: 요청이 많아지면 psycopg_pool(별도 승인 필요)로 연결 재사용.
"""
from __future__ import annotations

import os
from contextlib import contextmanager
from pathlib import Path

import psycopg
from psycopg.rows import dict_row

ROOT_ENV = Path(__file__).resolve().parents[3] / ".env"   # JH/api/common/db.py → 프로젝트 루트


def _env(key: str) -> str:
    if os.environ.get(key):
        return os.environ[key]
    if ROOT_ENV.exists():
        for line in ROOT_ENV.read_text(encoding="utf-8").splitlines():
            if line.strip().startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            if k.strip() == key:
                return v.strip().strip('"')
    raise RuntimeError(f"루트 .env 에 {key} 가 없습니다.")


@contextmanager
def connect(url_key: str):
    """with connect('HR_DATABASE_URL') as conn: ... — 정상 종료 시 커밋, 오류 시 롤백, 항상 닫음"""
    url = _env(url_key)
    # 웹 주소(https://…) 등 잘못 넣은 값을 원인이 보이게 안내 (값 자체는 비밀이라 메시지에 넣지 않음)
    if not url.startswith(("postgresql://", "postgres://")):
        raise RuntimeError(f"루트 .env 의 {url_key} 는 DB 접속 주소여야 합니다 — 형식: postgresql://계정:비밀번호@호스트:5432/aiax")
    with psycopg.connect(url, connect_timeout=10, row_factory=dict_row) as conn:
        yield conn
