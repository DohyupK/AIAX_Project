#!/bin/bash
# 서비스별 권한 그룹(role_*)과 접속 계정(app_*) 생성
# 비밀번호는 .env 값을 사용하며, 이 파일에는 적지 않음
set -euo pipefail

for v in APP_PRODUCER_PASSWORD APP_SPARK_PASSWORD APP_ML_PASSWORD APP_READONLY_PASSWORD; do
  if [ -z "${!v:-}" ]; then
    echo "[init] 환경변수 $v 가 비어 있습니다. .env 를 확인하세요." >&2
    exit 1
  fi
done

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
  -v producer_pw="$APP_PRODUCER_PASSWORD" \
  -v spark_pw="$APP_SPARK_PASSWORD" \
  -v ml_pw="$APP_ML_PASSWORD" \
  -v readonly_pw="$APP_READONLY_PASSWORD" <<'EOSQL'
-- 권한 그룹 (로그인 불가). 권한은 그룹에 주고 계정은 그룹에 소속시킨다.
CREATE ROLE role_producer NOLOGIN;  -- Data Producing APP: 원본 적재
CREATE ROLE role_spark    NOLOGIN;  -- Spark: 원본 읽기 → lake/mart 쓰기
CREATE ROLE role_ml       NOLOGIN;  -- AI 학습: mart 읽기
CREATE ROLE role_readonly NOLOGIN;  -- 조회·분석: 전체 읽기

-- 접속 계정
CREATE ROLE app_producer LOGIN PASSWORD :'producer_pw' IN ROLE role_producer;
CREATE ROLE app_spark    LOGIN PASSWORD :'spark_pw'    IN ROLE role_spark;
CREATE ROLE app_ml       LOGIN PASSWORD :'ml_pw'       IN ROLE role_ml;
CREATE ROLE app_readonly LOGIN PASSWORD :'readonly_pw' IN ROLE role_readonly;
EOSQL

echo "[init] 00_roles 완료"
