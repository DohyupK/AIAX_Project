"""NIM 임베딩 차원 CHECK(1536|2048) 적용 — psql 불필요.

  cwd=JH/api:
    uv run python -m documents.apply_dim_migration

또는:
    bash scripts/apply-embedding-dim-nim.sh
"""
from __future__ import annotations

import sys
from pathlib import Path

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


def main() -> int:
    if not SQL_PATH.is_file():
        print(f"SQL 없음: {SQL_PATH}", file=sys.stderr)
        return 1
    stmts = _statements(SQL_PATH.read_text(encoding="utf-8"))
    if not stmts:
        print("실행할 SQL 문장이 없습니다.", file=sys.stderr)
        return 1
    url = _env("DOCS_DATABASE_URL")
    with psycopg.connect(url, connect_timeout=10) as conn:
        for i, stmt in enumerate(stmts, start=1):
            print(f"-- ({i}/{len(stmts)}) {stmt.splitlines()[0][:72]}...")
            conn.execute(stmt)
    print(f"ok: {SQL_PATH.name} ({len(stmts)} statements)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
