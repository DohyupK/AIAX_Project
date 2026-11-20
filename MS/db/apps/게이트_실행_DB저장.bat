@echo off
chcp 65001 >nul
rem 보호구 게이트 판정 — DB 에 기록 (게이트 a). 루트 .env 에 GATE_DATABASE_URL 필요, init 25·29 실행돼 있어야 함. 카메라 창을 클릭한 뒤 카드 번호 입력 + Enter, Esc 종료
cd /d "%~dp0"
uv run --group gate python -m apps.gate_judge --gate a %*
pause
