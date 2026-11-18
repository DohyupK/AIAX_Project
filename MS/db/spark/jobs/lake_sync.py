"""mes·org → lake 증분 복제 (Spark 작업)

실행: spark-submit --packages org.postgresql:postgresql:42.7.4 lake_sync.py [mes|org|all]
접속 정보는 환경변수로 받음 (값은 루트 .env, 실행기 lake_runner 가 넘겨 줌)
  LAKE_SYNC_JDBC_URL   예: jdbc:postgresql://postgres:5432/aiax
  LAKE_SYNC_USER       예: app_spark
  LAKE_SYNC_PASSWORD   (APP_SPARK_PASSWORD)

처리 순서 (작업마다 한 트랜잭션)
  1. lake.etl_watermark 에서 처리 위치 W, 변경 기록의 현재 최대값 M 고정
  2. W < change_id <= M 의 변경을 키별 마지막 op 로 정리 (DB 쿼리)
  3. I/U 대상 원본 행을 Spark 로 읽어 lake 컬럼만 고름 (W = 0 이면 원본 전체 = 첫 전체 동기화)
  4. lake 에 upsert, D 대상 delete, 처리 위치를 M 으로 갱신 → commit
  실패하면 rollback 되어 처리 위치가 그대로 → 다음 실행이 같은 범위를 다시 처리 (여러 번 실행해도 결과 같음)
"""
from __future__ import annotations

import os
import sys

from pyspark.sql import SparkSession

# org → lake 복제 대상 (employee_info·hr_access_log·change_log 제외). 키 = <테이블>_idx
ORG_TABLES = [
    "position", "department", "team", "page", "vendor_company",
    "employee", "employee_status", "access_code", "dept_roster", "team_roster",
    "employee_card", "vendor_worker", "gate_card", "employee_gate_log", "vendor_gate_log",
    "attendance", "employee_record",
    "main_page", "process_optimization_page", "quality_inspection_page", "defect_labeling_page",
    "ppe_violation_page", "hr_management_page", "management_report_page", "model_management_page",
    "company_documents_page",
]


def env(key: str) -> str:
    v = os.environ.get(key)
    if not v:
        raise SystemExit(f"[lake_sync] 환경변수 {key} 가 비어 있습니다.")
    return v


class Db:
    """드라이버(JVM)의 JDBC 연결 하나로 조회·쓰기를 한 트랜잭션에서 처리"""

    def __init__(self, spark: SparkSession, url: str, user: str, password: str):
        jvm = spark._jvm
        self.conn = jvm.java.sql.DriverManager.getConnection(url, user, password)
        self.conn.setAutoCommit(False)

    def rows(self, sql: str, params: list | None = None) -> list[list]:
        st = self.conn.prepareStatement(sql)
        for i, p in enumerate(params or [], 1):
            st.setString(i, None if p is None else str(p))
        rs = st.executeQuery()
        n = rs.getMetaData().getColumnCount()
        out = []
        while rs.next():
            out.append([rs.getString(i) for i in range(1, n + 1)])
        rs.close()
        st.close()
        return out

    def execute(self, sql: str, params: list | None = None) -> int:
        st = self.conn.prepareStatement(sql)
        for i, p in enumerate(params or [], 1):
            st.setString(i, None if p is None else str(p))
        n = st.executeUpdate()
        st.close()
        return n

    def columns(self, schema: str, table: str) -> list[tuple[str, str]]:
        """(컬럼, 타입) — 타입은 ::캐스트에 쓰는 PostgreSQL 이름"""
        return [(c, t) for c, t in self.rows(
            "SELECT a.attname, format_type(a.atttypid, a.atttypmod) FROM pg_attribute a "
            "WHERE a.attrelid = (quote_ident(?) || '.' || quote_ident(?))::regclass "
            "AND a.attnum > 0 AND NOT a.attisdropped ORDER BY a.attnum",
            [schema, table])]

    def upsert(self, df, schema: str, table: str, key: str) -> int:
        """Spark DataFrame(전부 text) 행을 lake 테이블에 upsert — DB에서 원래 타입으로 캐스트"""
        cols = self.columns(schema, table)
        names = [c for c, _ in cols]
        q = lambda c: '"' + c.replace('"', '""') + '"'
        sql = (f"INSERT INTO {q(schema)}.{q(table)} ({', '.join(q(c) for c in names)}) "
               f"VALUES ({', '.join('CAST(? AS ' + t + ')' for _, t in cols)}) "
               f"ON CONFLICT ({q(key)}) DO UPDATE SET "
               + ", ".join(f"{q(c)} = EXCLUDED.{q(c)}" for c in names if c != key))
        st = self.conn.prepareStatement(sql)
        n = 0
        for row in df.select(names).toLocalIterator():  # 원본 쿼리에서 이미 text 로 읽음
            for i, c in enumerate(names, 1):
                st.setString(i, row[c])
            st.addBatch()
            n += 1
            if n % 1000 == 0:
                st.executeBatch()
        st.executeBatch()
        st.close()
        return n

    def commit(self):
        self.conn.commit()

    def rollback(self):
        self.conn.rollback()

    def close(self):
        self.conn.close()


def read_jdbc(spark: SparkSession, url: str, user: str, password: str, query: str):
    return (spark.read.format("jdbc")
            .option("url", url).option("user", user).option("password", password)
            .option("driver", "org.postgresql.Driver")
            .option("query", query)
            .load())


def watermark(db: Db, job: str, log_table: str) -> tuple[int, int]:
    w = db.rows("SELECT last_change_id FROM lake.etl_watermark WHERE job_name = ? FOR UPDATE", [job])
    if not w:
        raise SystemExit(f"[lake_sync] lake.etl_watermark 에 {job} 행이 없습니다.")
    m = db.rows(f"SELECT COALESCE(MAX(change_id), 0) FROM {log_table}")
    return int(w[0][0]), int(m[0][0])


def done(db: Db, job: str, m: int):
    db.execute("UPDATE lake.etl_watermark SET last_change_id = CAST(? AS bigint), last_run_at = now() "
               "WHERE job_name = ?", [m, job])


def sync_mes(spark, db: Db, url, user, pw) -> str:
    job = "mes_to_lake"
    w, m = watermark(db, job, "mes.investment_casting_change_log")
    if m == w:
        db.rollback()
        return f"{job}: 변경 없음 (W={w})"
    lake_cols = [c for c, _ in db.columns("lake", "lake_investment_casting")]
    sel = ", ".join(f'm."{c}"::text AS "{c}"' for c in lake_cols)  # 타입 변환 문제를 피하려고 text 로 읽고 DB에서 캐스트
    if w == 0:
        src = f"SELECT {sel} FROM mes.investment_casting m"     # 첫 전체 동기화
    else:
        src = (f"SELECT {sel} FROM mes.investment_casting m JOIN ("
               f" SELECT DISTINCT casting_id FROM mes.investment_casting_change_log"
               f" WHERE change_id > {w} AND change_id <= {m}) c USING (casting_id)")
    df = read_jdbc(spark, url, user, pw, src)
    n_up = db.upsert(df, "lake", "lake_investment_casting", "casting_id")
    n_del = db.execute(
        "DELETE FROM lake.lake_investment_casting WHERE casting_id IN ("
        " SELECT casting_id FROM (SELECT DISTINCT ON (casting_id) casting_id, op"
        "  FROM mes.investment_casting_change_log"
        "  WHERE change_id > CAST(? AS bigint) AND change_id <= CAST(? AS bigint)"
        "  ORDER BY casting_id, change_id DESC) x WHERE op = 'D')", [w, m])
    done(db, job, m)
    db.commit()
    return f"{job}: {w} → {m}, upsert {n_up}, delete {n_del}"


def sync_org(spark, db: Db, url, user, pw) -> str:
    job = "org_to_lake"
    w, m = watermark(db, job, "org.change_log")
    if m == w:
        db.rollback()
        return f"{job}: 변경 없음 (W={w})"
    total_up = total_del = 0
    for t in ORG_TABLES:
        key = f"{t}_idx"
        lake_t = f"lake_{t}"
        lake_cols = [c for c, _ in db.columns("lake", lake_t)]
        sel = ", ".join(f's."{c}"::text AS "{c}"' for c in lake_cols)
        src = (f'SELECT {sel} FROM org."{t}" s JOIN ('
               f" SELECT DISTINCT row_idx FROM org.change_log"
               f" WHERE table_name = '{t}' AND change_id > {w} AND change_id <= {m}) c"
               f' ON c.row_idx = s."{key}"')
        df = read_jdbc(spark, url, user, pw, src)
        total_up += db.upsert(df, "lake", lake_t, key)
        total_del += db.execute(
            f'DELETE FROM lake."{lake_t}" WHERE "{key}" IN ('
            " SELECT row_idx FROM (SELECT DISTINCT ON (row_idx) row_idx, op FROM org.change_log"
            "  WHERE table_name = ? AND change_id > CAST(? AS bigint) AND change_id <= CAST(? AS bigint)"
            "  ORDER BY row_idx, change_id DESC) x WHERE op = 'D')", [t, w, m])
    done(db, job, m)
    db.commit()
    return f"{job}: {w} → {m}, upsert {total_up}, delete {total_del}"


def main():
    target = sys.argv[1] if len(sys.argv) > 1 else "all"
    if target not in ("mes", "org", "all"):
        raise SystemExit("사용법: lake_sync.py [mes|org|all]")
    url, user, pw = env("LAKE_SYNC_JDBC_URL"), env("LAKE_SYNC_USER"), env("LAKE_SYNC_PASSWORD")
    spark = SparkSession.builder.appName(f"lake_sync_{target}").getOrCreate()
    db = Db(spark, url, user, pw)
    ok = True
    try:
        for name, fn in (("mes", sync_mes), ("org", sync_org)):
            if target in (name, "all"):
                try:
                    print("[lake_sync]", fn(spark, db, url, user, pw), flush=True)
                except Exception as e:  # 작업 하나가 실패해도 다른 작업은 진행
                    db.rollback()
                    ok = False
                    print(f"[lake_sync] {name} 실패 — 처리 위치 그대로: {e}", flush=True)
    finally:
        db.close()
        spark.stop()
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
