"""NIM 임베딩 차원 CHECK(1536|2048) 적용 — psql 불필요.

DDL은 테이블 소유/관리자(POSTGRES_USER=shift)로 실행.
app_docs(DOCS_DATABASE_URL)는 ALTER 권한 없음.

  cwd=JH/api:
    uv run python -m documents.apply_dim_migration

또는:
    bash scripts/apply-embedding-dim-nim.sh
"""
from __future__ import annotations

import os
import sys
from pathlib import Path
from urllib.parse import quote_plus, urlparse

import psycopg

from common.db import _env

# JH/api/documents → 프로젝트 루트
ROOT = Path(__file__).resolve().parents[3]
SQL_PATH = ROOT / "DH" / "data" / "sql" / "05_document_embedding_dim_nim.pg.sql"


def _statements(sql: str) -> list[str]:
    """세미콜론 단위로 나누고, 줄 주석만 있는 덩어리는 제외."""
    out: list[str] = []
    for raw in sql.split(";"):
        lines = []
        for line in raw.splitlines():
            s = line.strip()
            if not s or s.startswith("--"):
                continue
            lines.append(line)
        body = "\n".join(lines).strip()
        if body:
            out.append(body)
    return out


def _host_port_from_docs() -> tuple[str, str]:
    """DOCS_DATABASE_URL 에서 호스트·포트. 실패 시 127.0.0.1:5432."""
    try:
        docs = os.environ.get("DOCS_DATABASE_URL") or _env("DOCS_DATABASE_URL")
    except RuntimeError:
        docs = ""
    if docs:
        u = urlparse(docs)
        host = u.hostname or "127.0.0.1"
        port = str(u.port or 5432)
        return host, port
    return "127.0.0.1", "5432"


def _ddl_url() -> tuple[str, str]:
    """POSTGRES_USER/PASSWORD 로 DDL URL. (user, url) 반환."""
    try:
        user = (os.environ.get("POSTGRES_USER") or _env("POSTGRES_USER")).strip()
        password = (os.environ.get("POSTGRES_PASSWORD") or _env("POSTGRES_PASSWORD")).strip()
    except RuntimeError as e:
        raise RuntimeError(
            "DDL용 POSTGRES_USER / POSTGRES_PASSWORD 가 루트 .env 에 필요합니다. "
            "(app_docs 로는 ALTER 불가 — must be owner of table)"
        ) from e
    if not user or not password:
        raise RuntimeError("POSTGRES_USER / POSTGRES_PASSWORD 가 비어 있습니다.")
    try:
        db = (os.environ.get("POSTGRES_DB") or _env("POSTGRES_DB")).strip() or "aiax"
    except RuntimeError:
        db = "aiax"
    host, port = _host_port_from_docs()
    url = (
        f"postgresql://{quote_plus(user)}:{quote_plus(password)}"
        f"@{host}:{port}/{db}"
    )
    return user, url


def main() -> int:
    if not SQL_PATH.is_file():
        print(f"SQL 없음: {SQL_PATH}", file=sys.stderr)
        return 1
    stmts = _statements(SQL_PATH.read_text(encoding="utf-8"))
    if not stmts:
        print("실행할 SQL 문장이 없습니다.", file=sys.stderr)
        return 1
    try:
        user, url = _ddl_url()
    except RuntimeError as e:
        print(str(e), file=sys.stderr)
        return 1
    print(f"DDL user={user} (app_docs 아님)")
    with psycopg.connect(url, connect_timeout=10) as conn:
        for i, stmt in enumerate(stmts, start=1):
            print(f"-- ({i}/{len(stmts)}) {stmt.splitlines()[0][:72]}...")
            conn.execute(stmt)
    print(f"ok: {SQL_PATH.name} ({len(stmts)} statements)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
