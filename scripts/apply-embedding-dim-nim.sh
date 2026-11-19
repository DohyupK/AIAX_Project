#!/usr/bin/env bash
# NIM 임베딩 차원 CHECK(1536|2048) — psql 없이 JH/api psycopg로 적용
# 서버: bash /root/AIAX_Project/scripts/apply-embedding-dim-nim.sh
# 이후: cd JH/api && uv run python -m documents.requeue_all
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/JH/api"
uv run python -m documents.apply_dim_migration
