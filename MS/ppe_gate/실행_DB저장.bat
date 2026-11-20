@echo off
chcp 65001 >nul
rem 보호구 게이트 판정 — DB 에 기록 (게이트 a). 이 폴더에 .env (DATABASE_URL) 필요, init 24·25 실행돼 있어야 함
"D:\cas_image\.venv\Scripts\python.exe" "%~dp0gate_judge.py" --gate a %*
pause
