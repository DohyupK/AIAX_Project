"""주조 공정 데이터 전체 교체 + casting_id 규칙에 라인 추가 (2026-11-19, MS)

배경
  - casting_id 가 「날짜_시각_생산번호」라 라인 정보가 없음. 라인이 3개가 되면서
    line_no2·line_no3 에 날짜·시각·생산번호가 같은 샷이 생겨 번호가 겹침 (새 데이터 11쌍).
  - 새 규칙: 「L라인번호_날짜_시각_생산번호」 (예: L3_261101_000000_1)
  - 새 데이터(CSV 3개)로 mes 를 전부 교체하고, lake·mart 복사본도 새 번호로 다시 만듦.

실행 (MS/db/apps 에서)
  uv run python -m apps.reload_casting --dry-run   # 끝까지 실제로 해 보고 마지막에 전부 취소 (DB 변경 없음)
  uv run python -m apps.reload_casting             # 백업 → 교체 → 검증 → 확정

순서 (한 트랜잭션 — 어느 단계든 실패하면 전부 취소)
  0 안전 확인(라벨·판정·후보 풀 0건) → 1 백업(CSV) → 2 이미지 삭제 → 3 mart·lake 비우기
  → 4 mes 전체 삭제 → 5 casting_id 규칙 변경 → 6 CSV 전체 추가 → 7 lake 채우기(mes 전체 복사, lake_sync 와 같은 방식)
  → 8 mart 채우기(원래 범위: line_no1·--mart-until 까지, 빈 값 제외) → 9 lake 처리 위치 갱신 → 10 검증 → 확정
접속: 관리자(루트 .env POSTGRES_USER/POSTGRES_PASSWORD/POSTGRES_DB, 호스트·포트는 DATABASE_URL)
"""
from __future__ import annotations

import argparse
import csv
import os
import sys
from datetime import datetime
from pathlib import Path
from urllib.parse import urlparse

import psycopg

ROOT_ENV = Path(__file__).resolve().parents[5] / ".env"   # MS/db/apps/src/apps → 프로젝트 루트
CSV_FILES = ("line_no1_full.csv", "line_no2.csv", "line_no3.csv")
# mes 에 넣는 칼럼 (casting_id 는 DB 가 자동 생성)
COLUMNS = ["line_unit", "production", "timestamp", "date", "production_count",
           "mold_temperature", "facility_cycletime", "production_cycletime", "mechanical_strength",
           "molten_capacity", "injection_pressure", "sleeve_temperature",
           "top_temp1", "top_temp2", "top_temp3", "top_temp4",
           "bottom_temp1", "bottom_temp2", "bottom_temp3", "bottom_temp4",
           "biscuit_thickness", "cooling_water_temp", "passorfail"]
INT_COLUMNS = {"production_count", "passorfail"}   # CSV 에 "0.0" 처럼 들어 있어 정수로 바꿈
# 새 casting_id 규칙 — init/03_mes.sql 과 같아야 함
CASTING_ID_EXPR = """
    'L' || regexp_replace(line_unit, '[^0-9]', '', 'g') || '_' ||
    lpad((extract(year  FROM "timestamp")::int % 100)::text, 2, '0') ||
    lpad( extract(month FROM "timestamp")::int::text, 2, '0') ||
    lpad( extract(day   FROM "timestamp")::int::text, 2, '0') || '_' ||
    lpad( extract(hour   FROM "date")::int::text, 2, '0') ||
    lpad( extract(minute FROM "date")::int::text, 2, '0') ||
    lpad( floor(extract(second FROM "date"))::int::text, 2, '0') || '_' ||
    production_count::text"""
# 사람·AI 가 만든 데이터 — 하나라도 있으면 중단 (번호가 바뀌면 연결이 끊김)
GUARDS = {
    "ai.defect_label": "SELECT count(*) FROM ai.defect_label",
    "ai.defect_discard": "SELECT count(*) FROM ai.defect_discard",
    "ai.quality_prediction": "SELECT count(*) FROM ai.quality_prediction",
    "ai.quality_image_pool(매칭)": "SELECT count(matched_casting_id) FROM ai.quality_image_pool",
}


def log(msg: str) -> None:
    print(f"[reload_casting {datetime.now():%Y-%m-%d %H:%M:%S}] {msg}", flush=True)


def load_env() -> None:
    """루트 .env 값을 환경변수로 (이미 있는 값은 그대로)"""
    if not ROOT_ENV.exists():
        raise SystemExit(f"[reload_casting] 루트 .env 가 없습니다: {ROOT_ENV}")
    for line in ROOT_ENV.read_text(encoding="utf-8").splitlines():
        if line.strip().startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        os.environ.setdefault(k.strip(), v.strip().strip('"'))


def admin_conninfo() -> dict:
    """관리자 접속 정보 — 비밀번호를 URL 에 넣지 않아 특수문자 문제 없음"""
    u = urlparse(os.environ.get("DATABASE_URL", ""))
    need = {k: os.environ.get(k) for k in ("POSTGRES_USER", "POSTGRES_PASSWORD", "POSTGRES_DB")}
    missing = [k for k, v in need.items() if not v] + ([] if u.hostname else ["DATABASE_URL(호스트)"])
    if missing:
        raise SystemExit(f"[reload_casting] 루트 .env 에 값이 없습니다: {', '.join(missing)}")
    return dict(host=u.hostname, port=u.port or 5432, dbname=need["POSTGRES_DB"],
                user=need["POSTGRES_USER"], password=need["POSTGRES_PASSWORD"], connect_timeout=15)


def to_value(col: str, v: str | None):
    """CSV 칸 → DB 값 (빈 칸 = NULL)"""
    if v is None or v.strip() == "":
        return None
    v = v.strip()
    return str(int(float(v))) if col in INT_COLUMNS else v


def read_csv(csv_dir: Path) -> list[list]:
    rows = []
    for name in CSV_FILES:
        path = csv_dir / name
        if not path.exists():
            raise SystemExit(f"[reload_casting] CSV 가 없습니다: {path}")
        with path.open(encoding="utf-8-sig", newline="") as f:
            for r in csv.DictReader(f):
                r = {k.strip().lower(): v for k, v in r.items()}
                rows.append([to_value(c, r.get(c)) for c in COLUMNS])
        log(f"CSV 읽음: {name}")
    return rows


def one(conn, sql: str, params=None):
    return conn.execute(sql, params).fetchone()[0]


def table_columns(conn, schema: str, table: str) -> list[str]:
    return [r[0] for r in conn.execute(
        "SELECT attname FROM pg_attribute WHERE attrelid = (quote_ident(%s) || '.' || quote_ident(%s))::regclass "
        "AND attnum > 0 AND NOT attisdropped ORDER BY attnum", (schema, table)).fetchall()]


def backup(conn, out_dir: Path) -> None:
    """지울 데이터를 CSV 로 저장 (되돌리기용)"""
    out_dir.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    with conn.cursor() as cur:
        for t in ("mes.investment_casting", "mes.casting_image", "lake.lake_casting_image", "mart.mart_investment_casting"):
            path = out_dir / f"{t.replace('.', '_')}_{stamp}.csv"
            with path.open("wb") as f, cur.copy(f"COPY {t} TO STDOUT WITH (FORMAT csv, HEADER)") as cp:
                for chunk in cp:
                    f.write(chunk)
            log(f"백업: {path} ({path.stat().st_size:,} bytes)")


def main() -> None:
    ap = argparse.ArgumentParser(description="주조 공정 데이터 전체 교체 + casting_id 라인 포함")
    ap.add_argument("--csv-dir", default=r"D:\AIAX_data\casting_process")
    ap.add_argument("--backup-dir", default=r"D:\AIAX_data\backup")
    ap.add_argument("--mart-until", default="2026-10-11", help="mart 에 다시 넣을 범위 (line_no1, 이 날짜까지) — 지금 mart 와 같은 범위")
    ap.add_argument("--dry-run", action="store_true", help="끝까지 실행한 뒤 전부 취소 (DB 변경 없음)")
    a = ap.parse_args()
    load_env()

    new_rows = read_csv(Path(a.csv_dir))
    by_line: dict[str, int] = {}
    for r in new_rows:
        by_line[r[0]] = by_line.get(r[0], 0) + 1
    log(f"CSV 샷: {len(new_rows):,} {by_line}")

    with psycopg.connect(**admin_conninfo()) as conn:
        # 0. 안전 확인
        guards = {k: one(conn, q) for k, q in GUARDS.items()}
        log("안전 확인: " + ", ".join(f"{k}={n}" for k, n in guards.items()))
        if any(guards.values()):
            raise SystemExit("[reload_casting] 중단: 라벨·판정·매칭 데이터가 있음 — 번호가 바뀌면 연결이 끊김")
        before = {t: one(conn, f"SELECT count(*) FROM {t}") for t in
                  ("mes.investment_casting", "lake.lake_investment_casting", "mart.mart_investment_casting",
                   "mes.casting_image", "lake.lake_casting_image")}
        log("현재: " + ", ".join(f"{t}={n:,}" for t, n in before.items()))

        # 1. 백업 (dry-run 은 생략)
        if not a.dry_run:
            backup(conn, Path(a.backup_dir))
        conn.commit()

        lake_cols = table_columns(conn, "lake", "lake_investment_casting")
        mart_cols = table_columns(conn, "mart", "mart_investment_casting")
        q = lambda cs: ", ".join(f'"{c}"' for c in cs)
        try:
            with conn.transaction():
                # 2. 이미지 삭제
                for t in ("lake.lake_casting_image", "mes.casting_image"):
                    log(f"2 삭제 {t}: {conn.execute(f'DELETE FROM {t}').rowcount:,}")
                # 3. 복사본 비우기 (mart 가 lake 를, lake 가 mes 를 참조 → 이 순서)
                for t in ("mart.mart_investment_casting", "lake.lake_investment_casting"):
                    log(f"3 삭제 {t}: {conn.execute(f'DELETE FROM {t}').rowcount:,}")
                # 4. mes 전체 삭제 (트리거가 change_log 에 D 기록)
                log(f"4 삭제 mes.investment_casting: {conn.execute('DELETE FROM mes.investment_casting').rowcount:,}")
                # 5. casting_id 규칙 변경 (테이블이 비어 있어 바로 적용)
                conn.execute(f"ALTER TABLE mes.investment_casting ALTER COLUMN casting_id SET EXPRESSION AS ({CASTING_ID_EXPR})")
                log("5 casting_id 규칙 변경: L라인번호_날짜_시각_생산번호")
                # 6. CSV 전체 추가 (트리거가 change_log 에 I 기록)
                with conn.cursor().copy(f"COPY mes.investment_casting ({q(COLUMNS)}) FROM STDIN") as cp:
                    for r in new_rows:
                        cp.write_row(r)
                mes_n = one(conn, "SELECT count(*) FROM mes.investment_casting")
                log(f"6 추가 mes.investment_casting: {mes_n:,}")
                # 7. lake 채우기 — lake_sync 와 같은 방식 (lake 칼럼만 그대로 복사)
                n = conn.execute(f"INSERT INTO lake.lake_investment_casting ({q(lake_cols)}) "
                                 f"SELECT {q(lake_cols)} FROM mes.investment_casting").rowcount
                log(f"7 추가 lake.lake_investment_casting: {n:,}")
                # 8. mart 채우기 — 지금 mart 와 같은 범위·조건 (tests/fill_mart_trial.sql 규칙)
                n = conn.execute(f"INSERT INTO mart.mart_investment_casting ({q(mart_cols)}) "
                                 f"SELECT {q(mart_cols)} FROM lake.lake_investment_casting "
                                 f"WHERE molten_capacity IS NOT NULL AND passorfail IS NOT NULL "
                                 f"AND line_unit = 'line_no1' AND \"timestamp\" <= %s", (a.mart_until,)).rowcount
                log(f"8 추가 mart.mart_investment_casting: {n:,}")
                # 9. lake 처리 위치 = 지금 변경 기록 끝 (lake 가 이미 최신이므로 lake_sync 가 다시 처리하지 않게)
                conn.execute("UPDATE lake.etl_watermark SET last_change_id = "
                             "(SELECT COALESCE(max(change_id), 0) FROM mes.investment_casting_change_log), last_run_at = now() "
                             "WHERE job_name = 'mes_to_lake'")
                log("9 lake 처리 위치 갱신 (mes_to_lake)")
                # 10. 검증
                lines = dict(conn.execute("SELECT line_unit, count(*) FROM mes.investment_casting GROUP BY 1").fetchall())
                checks = {
                    "mes 건수 = CSV": (mes_n, len(new_rows)),
                    "라인별 건수 = CSV": (lines, by_line),
                    "lake 건수 = mes": (one(conn, "SELECT count(*) FROM lake.lake_investment_casting"), mes_n),
                    "mart 건수 = 교체 전": (one(conn, "SELECT count(*) FROM mart.mart_investment_casting"),
                                          before["mart.mart_investment_casting"]),
                    "L 없는 번호 = 0": (one(conn, "SELECT count(*) FROM mes.investment_casting WHERE casting_id NOT LIKE 'L%'"), 0),
                }
                bad = {k: v for k, v in checks.items() if v[0] != v[1]}
                for k, (got, want) in checks.items():
                    log(f"10 검증 {'OK ' if k not in bad else 'X  '}{k}: {got} / {want}")
                if bad:
                    raise RuntimeError(f"검증 실패 {list(bad)} — 전부 취소")
                for line, lo, hi in conn.execute(
                        'SELECT line_unit, min("timestamp"), max("timestamp") FROM mes.investment_casting GROUP BY 1 ORDER BY 1'):
                    log(f"   {line}: {lo} ~ {hi}")
                if a.dry_run:
                    raise psycopg.Rollback()
            log("[dry-run] 끝까지 성공 — 전부 취소함 (DB 변경 없음)" if a.dry_run else "확정 완료")
        except RuntimeError as e:
            log(str(e))
            sys.exit(1)


if __name__ == "__main__":
    try:
        main()
    except psycopg.Error as e:
        log(f"DB 오류 — 바뀐 것 없음 (트랜잭션 취소): {e}")
        sys.exit(1)
