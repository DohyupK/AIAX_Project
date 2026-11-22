#!/usr/bin/env bash
# Next(:3000) + JH FastAPI(:8000) + DH al_price serve(:8766)를 tmux 세션 myapp에 동시 기동
# 일상: systemctl restart myapp  (ExecStart가 이 스크립트를 가리킴)
# 로그: tmux attach -t myapp  →  Ctrl+b n 으로 창 전환  →  Ctrl+b d detach
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SESSION=myapp
UV="$(command -v uv)"
PNPM="$(command -v pnpm)"

if [[ -z "${UV}" ]]; then
  echo "uv 없음 — https://docs.astral.sh/uv/ 설치 후 PATH에 두세요." >&2
  exit 1
fi
if [[ -z "${PNPM}" ]]; then
  echo "pnpm 없음 — corepack enable && corepack prepare pnpm@latest --activate" >&2
  exit 1
fi

tmux has-session -t "${SESSION}" 2>/dev/null && tmux kill-session -t "${SESSION}"

# window next — 루트 Next.js (/al-price/api/prices → :8766 프록시)
tmux new-session -d -s "${SESSION}" -n next -c "${ROOT}" \
  "${PNPM} dev"

# window api — JH FastAPI (인사·주조). 127.0.0.1만 (외부는 nginx /api)
tmux new-window -t "${SESSION}:" -n api -c "${ROOT}/JH/api" \
  "${UV} run uvicorn main:app --host 127.0.0.1 --port 8000"

# window al_price — LME Al 시세 조회. 127.0.0.1:8766 (Next rewrite / nginx)
tmux new-window -t "${SESSION}:" -n al_price -c "${ROOT}/DH/api" \
  "${UV} run python -m aluminum_price serve"

exit 0
