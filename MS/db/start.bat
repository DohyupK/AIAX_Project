@echo off
chcp 65001 >nul
setlocal EnableExtensions
cd /d "%~dp0"

echo.
echo ========================================
echo  aiax-db Docker 기동 메뉴 (Windows)
echo  compose 파일은 수정하지 않습니다.
echo ========================================
echo.
echo   1^) Postgres만          ^(NCP 서버 / DB만^)
echo   2^) 처리만              ^(Kafka, Spark, Flink — 로컬 처리^)
echo   3^) 전부                ^(PG + 처리^)
echo   0^) 취소
echo.

set "CHOICE="
set /p CHOICE=번호 입력 후 Enter: 

if "%CHOICE%"=="1" goto PG
if "%CHOICE%"=="2" goto PIPE
if "%CHOICE%"=="3" goto ALL
if "%CHOICE%"=="0" goto CANCEL
echo [오류] 잘못된 입력입니다.
pause
exit /b 1

:PG
echo.
echo [실행] docker compose up -d postgres
docker compose up -d postgres
goto END

:PIPE
echo.
echo [실행] docker compose up -d kafka kafka-ui spark-master spark-worker flink-jobmanager flink-taskmanager
docker compose up -d kafka kafka-ui spark-master spark-worker flink-jobmanager flink-taskmanager
goto END

:ALL
echo.
echo [실행] docker compose up -d
docker compose up -d
goto END

:CANCEL
echo 취소했습니다.
exit /b 0

:END
if errorlevel 1 (
  echo.
  echo [실패] docker compose 오류. Docker Desktop/daemon 과 .env 를 확인하세요.
  pause
  exit /b 1
)
echo.
echo [완료] 상태 확인: docker compose ps
docker compose ps
echo.
pause
exit /b 0
