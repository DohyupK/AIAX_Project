#!/bin/bash
# 서비스별 권한 그룹(role_*)과 접속 계정(app_*) 생성
# 비밀번호는 .env 값을 사용하며, 이 파일에는 적지 않음
set -euo pipefail

for v in APP_MES_PASSWORD APP_SPARK_PASSWORD APP_MART_PASSWORD APP_LAKE_PASSWORD; do
  if [ -z "${!v:-}" ]; then
    echo "[init] 환경변수 $v 가 비어 있습니다. .env 를 확인하세요." >&2
    exit 1
  fi
done

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
  -v mes_pw="$APP_MES_PASSWORD" \
  -v spark_pw="$APP_SPARK_PASSWORD" \
  -v mart_pw="$APP_MART_PASSWORD" \
  -v lake_pw="$APP_LAKE_PASSWORD" <<'EOSQL'
-- 권한 그룹 (로그인 불가). 권한은 그룹에 주고 계정은 그룹에 소속시킨다.
CREATE ROLE role_mes   NOLOGIN;  -- mes 원본 적재
CREATE ROLE role_spark NOLOGIN;  -- Spark: 원본 읽기 → lake/mart 쓰기
CREATE ROLE role_mart  NOLOGIN;  -- AI 학습: mart 읽기
CREATE ROLE role_lake  NOLOGIN;  -- 조회·분석: 전체 읽기 (DH 등)

-- 접속 계정
CREATE ROLE app_mes   LOGIN PASSWORD :'mes_pw'   IN ROLE role_mes;
CREATE ROLE app_spark LOGIN PASSWORD :'spark_pw' IN ROLE role_spark;
CREATE ROLE app_mart  LOGIN PASSWORD :'mart_pw'  IN ROLE role_mart;
CREATE ROLE app_lake  LOGIN PASSWORD :'lake_pw'  IN ROLE role_lake;
EOSQL

echo "[init] 00_roles 완료"
