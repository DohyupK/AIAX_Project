@echo off
chcp 65001 >nul
rem 보호구 게이트 판정 — DB 없이 시험 (게이트 a). 카메라 창을 클릭한 뒤 카드 번호 입력 + Enter, Esc 종료
cd /d "%~dp0"
uv run --group gate python -m apps.gate_judge --gate a --no-db %*
pause
