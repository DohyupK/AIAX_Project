#!/usr/bin/env bash
# 서버(/root/AIAX_Project)에서 실행 — DOCS_DATABASE_URL 호스트를 127.0.0.1 로, DOCUMENT_ROOT=/document
# 사용: bash scripts/fix-docs-db-host.sh
# 원인: 공인 IP 로 붙으면 ConnectionTimeout (개발과정/서버배포_aiax.md §5)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV="$ROOT/.env"

if [[ ! -f "$ENV" ]]; then
  echo "없음: $ENV" >&2
  exit 1
fi

echo "== before =="
grep -E '^(DOCS_DATABASE_URL|DOCUMENT_ROOT|DATABASE_URL|HR_DATABASE_URL)=' "$ENV" \
  | sed -E 's#(postgresql://[^:]+:)[^@]+@#\1***@#' || true

# DOCS 호스트만 loopback 으로 (비밀번호·계정·DB명 유지)
if grep -q '^DOCS_DATABASE_URL=' "$ENV"; then
  sed -i -E 's#^(DOCS_DATABASE_URL=postgresql://[^@]+@)[^:/]+#\1127.0.0.1#' "$ENV"
else
  echo "DOCS_DATABASE_URL 없음 — server-env.snippet.env 참고해 추가하세요." >&2
  exit 1
fi

# Windows 경로가 서버에 남아 있으면 /document 로
if grep -q '^DOCUMENT_ROOT=' "$ENV"; then
  sed -i -E 's#^DOCUMENT_ROOT=.*#DOCUMENT_ROOT=/document#' "$ENV"
else
  printf '\nDOCUMENT_ROOT=/document\n' >> "$ENV"
fi

mkdir -p /document

echo "== after =="
grep -E '^(DOCS_DATABASE_URL|DOCUMENT_ROOT)=' "$ENV" \
  | sed -E 's#(postgresql://[^:]+:)[^@]+@#\1***@#'

# API 재기동 (systemd myapp 또는 tmux)
if systemctl is-enabled myapp >/dev/null 2>&1 || systemctl cat myapp >/dev/null 2>&1; then
  systemctl restart myapp
  echo "restarted: myapp"
elif tmux has-session -t myapp 2>/dev/null; then
  tmux kill-session -t myapp || true
  bash "$ROOT/scripts/dev-up.sh"
  echo "restarted: tmux myapp via dev-up.sh"
else
  echo "myapp 서비스를 찾지 못했습니다. JH API 를 수동 재시작하세요." >&2
fi

sleep 2
echo "== verify =="
# 비밀번호 노출 없이 호스트만 확인 후 API 호출
python3 - <<'PY'
import os, re, urllib.request
from pathlib import Path
env = Path("/root/AIAX_Project/.env").read_text(encoding="utf-8")
m = re.search(r"^DOCS_DATABASE_URL=postgresql://[^@]+@([^:/]+)", env, re.M)
host = m.group(1) if m else "?"
print("DOCS host:", host)
if host != "127.0.0.1":
    raise SystemExit("DOCS host still not 127.0.0.1")
PY

code=$(curl -s -o /tmp/docs_list.json -w "%{http_code}" --connect-timeout 5 http://127.0.0.1:8000/api/documents || echo "err")
echo "GET /api/documents → HTTP $code"
if [[ "$code" != "200" ]]; then
  head -c 400 /tmp/docs_list.json 2>/dev/null || true
  echo
  exit 1
fi
echo "OK"
