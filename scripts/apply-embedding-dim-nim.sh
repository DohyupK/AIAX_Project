#!/usr/bin/env bash
# NIM 임베딩 차원 CHECK(1536|2048) — psql 불필요
# ALTER는 POSTGRES_USER(shift)로 실행 (app_docs 는 소유자 아님 → InsufficientPrivilege)
# 서버: bash /root/AIAX_Project/scripts/apply-embedding-dim-nim.sh
# 이후: cd JH/api && uv run python -m documents.requeue_all
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/JH/api"
uv run python -m documents.apply_dim_migration
