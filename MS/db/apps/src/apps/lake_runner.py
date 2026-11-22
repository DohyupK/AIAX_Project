"""lake 자동 갱신 실행기 — 매일 00:00 KST 에 Spark 작업(lake_sync.py)을 실행

실행 (MS/db/apps 에서)
  uv run python -m apps.lake_runner          # 상주: 매일 00:00 KST 실행, 시작 시 밀린 변경 따라잡기
  uv run python -m apps.lake_runner --now    # 지금 한 번만 실행 (첫 동기화·장애 복구용)

설정은 프로젝트 루트 .env (값이 없으면 기본값)
  LAKE_SYNC_DATABASE_URL  실행기가 처리 위치를 확인할 DB 주소 (예: postgresql://app_spark:비밀번호@127.0.0.1:5432/aiax)
  LAKE_SYNC_JDBC_URL      Spark 가 접속할 DB 주소 (기본: jdbc:postgresql://postgres:5432/aiax — Docker 안 Spark 기준)
  LAKE_SYNC_USER          기본 app_spark
  LAKE_SYNC_PASSWORD      기본 APP_SPARK_PASSWORD
  SPARK_SUBMIT            spark-submit 명령 (기본: docker exec ... aiax-spark-master /opt/spark/bin/spark-submit)
  SPARK_MASTER            기본 spark://spark-master:7077
  LAKE_SYNC_JOB           Spark 작업 파일 경로 (기본: /opt/spark/jobs/lake_sync.py)
  SPARK_PACKAGES          기본 org.postgresql:postgresql:42.7.4
서버에서는 서버 관리자가 위 값을 서버 .env 에 맞추면 됨 (코드 수정 없음)
"""
from __future__ import annotations

import os
import shlex
import subprocess
import sys
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

import psycopg

try:
    KST = ZoneInfo("Asia/Seoul")
except Exception:  # Windows 에 tzdata 가 없을 때 — 한국은 서머타임이 없어 UTC+9 고정과 같음
    KST = timezone(timedelta(hours=9), "KST")
ROOT_ENV = Path(__file__).resolve().parents[5] / ".env"   # MS/db/apps/src/apps → 프로젝트 루트
LOCK_KEY = 20261118          # 동시에 1개만 실행 (pg_try_advisory_lock)
JOBS = (("mes_to_lake", "mes.investment_casting_change_log"), ("org_to_lake", "org.change_log"))


def load_env() -> None:
    """루트 .env 값을 환경변수로 (이미 있는 값은 그대로)"""
    if not ROOT_ENV.exists():
        return
    for line in ROOT_ENV.read_text(encoding="utf-8").splitlines():
        if line.strip().startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        os.environ.setdefault(k.strip(), v.strip().strip('"'))


def setting(key: str, default: str | None = None) -> str:
    v = os.environ.get(key) or default
    if not v:
        raise SystemExit(f"[lake_runner] 루트 .env 에 {key} 가 없습니다.")
    return v


def log(msg: str) -> None:
    print(f"[lake_runner {datetime.now(KST):%Y-%m-%d %H:%M:%S} KST] {msg}", flush=True)


def status(conn) -> list[tuple[str, int, int, datetime | None]]:
    """작업별 (이름, 처리 위치, 변경 기록 최대값, 마지막 실행)"""
    out = []
    for job, log_table in JOBS:
        w, last = conn.execute(
            "SELECT last_change_id, last_run_at FROM lake.etl_watermark WHERE job_name = %s", [job]).fetchone()
        m = conn.execute(f"SELECT COALESCE(MAX(change_id), 0) FROM {log_table}").fetchone()[0]
        out.append((job, w, m, last))
    return out


def run_once() -> bool:
    """밀린 변경이 있으면 Spark 작업 실행. 성공·변경 없음이면 True"""
    with psycopg.connect(setting("LAKE_SYNC_DATABASE_URL"), connect_timeout=10, autocommit=True) as conn:
        if not conn.execute("SELECT pg_try_advisory_lock(%s)", [LOCK_KEY]).fetchone()[0]:
            log("다른 실행이 진행 중이라 건너뜀")
            return True
        try:
            jobs = status(conn)
            pending = [j for j, w, m, _ in jobs if m > w]
            if not pending:
                log("변경 없음 — Spark 실행 안 함 (" + ", ".join(f"{j} W={w}" for j, w, _, _ in jobs) + ")")
                return True
            target = "all" if len(pending) == 2 else pending[0].split("_")[0]
            env = dict(os.environ,
                       LAKE_SYNC_JDBC_URL=setting("LAKE_SYNC_JDBC_URL", "jdbc:postgresql://postgres:5432/aiax"),
                       LAKE_SYNC_USER=setting("LAKE_SYNC_USER", "app_spark"),
                       LAKE_SYNC_PASSWORD=setting("LAKE_SYNC_PASSWORD", os.environ.get("APP_SPARK_PASSWORD")))
            submit = shlex.split(setting(
                "SPARK_SUBMIT",
                "docker exec -e LAKE_SYNC_JDBC_URL -e LAKE_SYNC_USER -e LAKE_SYNC_PASSWORD "
                "aiax-spark-master /opt/spark/bin/spark-submit"))
            cmd = submit + ["--master", setting("SPARK_MASTER", "spark://spark-master:7077"),
                            "--packages", setting("SPARK_PACKAGES", "org.postgresql:postgresql:42.7.4"),
                            setting("LAKE_SYNC_JOB", "/opt/spark/jobs/lake_sync.py"), target]
            log(f"Spark 작업 시작: {target} (대기 중: {', '.join(pending)})")
            started = time.monotonic()
            r = subprocess.run(cmd, env=env, capture_output=True, text=True)
            for line in (r.stdout or "").splitlines():
                if line.startswith("[lake_sync]"):
                    log(line)
            took = time.monotonic() - started
            if r.returncode != 0:
                log(f"Spark 작업 실패 (종료 코드 {r.returncode}, {took:.0f}초) — 처리 위치 그대로, 다음 실행 때 다시 처리")
                log((r.stderr or "").strip()[-2000:])
                return False
            log(f"Spark 작업 완료 ({took:.0f}초)")
            return True
        finally:
            conn.execute("SELECT pg_advisory_unlock(%s)", [LOCK_KEY])


def missed_today() -> bool:
    """오늘 00:00 KST 실행을 놓쳤고 밀린 변경이 있는지 (따라잡기)"""
    today0 = datetime.now(KST).replace(hour=0, minute=0, second=0, microsecond=0)
    with psycopg.connect(setting("LAKE_SYNC_DATABASE_URL"), connect_timeout=10) as conn:
        return any(m > w and (last is None or last < today0) for _, w, m, last in status(conn))


def next_midnight() -> datetime:
    now = datetime.now(KST)
    return (now + timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)


def main() -> None:
    load_env()
    if "--now" in sys.argv:
        sys.exit(0 if run_once() else 1)
    log("상주 시작 — 매일 00:00 KST 실행")
    try:
        if missed_today():
            log("놓친 실행이 있어 바로 따라잡기")
            run_once()
    except Exception as e:  # DB 접속 실패 등: 다음 자정에 다시 시도
        log(f"시작 확인 실패: {e}")
    while True:
        nxt = next_midnight()
        log(f"다음 실행: {nxt:%Y-%m-%d %H:%M} KST")
        time.sleep(max(1, (nxt - datetime.now(KST)).total_seconds()))
        try:
            run_once()
        except Exception as e:
            log(f"실행 실패: {e} — 다음 자정에 다시 시도")


if __name__ == "__main__":
    main()
