#!/usr/bin/env bash
# aiax-db Docker 기동 메뉴 (Linux — NCP Ubuntu 등)
# compose 파일은 수정하지 않습니다. 선택에 따라 up 대상만 바꿉니다.
set -euo pipefail
cd "$(dirname "$0")"

# 루트 .env: 컨테이너 env_file + compose 변수 치환(POSTGRES_BIND_IP 등)
ROOT_ENV="../../.env"
if [[ ! -f "$ROOT_ENV" ]]; then
  echo "[오류] 프로젝트 루트 .env 가 없습니다: $ROOT_ENV" >&2
  exit 1
fi
DC=(docker compose --env-file "$ROOT_ENV")

echo
echo "========================================"
echo " aiax-db Docker 기동 메뉴 (Linux)"
echo " compose 파일은 수정하지 않습니다."
echo "========================================"
echo
echo "  1) Postgres만          (NCP 서버 / DB만)"
echo "  2) 처리만              (Kafka, Spark, Flink — 로컬 처리)"
echo "  3) 전부                (PG + 처리)"
echo "  0) 취소"
echo

read -r -p "번호 입력 후 Enter: " CHOICE

case "$CHOICE" in
  1)
    echo
    echo "[실행] docker compose --env-file ../../.env up -d postgres"
    "${DC[@]}" up -d postgres
    ;;
  2)
    echo
    echo "[실행] docker compose --env-file ../../.env up -d kafka kafka-ui spark-master spark-worker flink-jobmanager flink-taskmanager"
    "${DC[@]}" up -d kafka kafka-ui spark-master spark-worker flink-jobmanager flink-taskmanager
    ;;
  3)
    echo
    echo "[실행] docker compose --env-file ../../.env up -d"
    "${DC[@]}" up -d
    ;;
  0)
    echo "취소했습니다."
    exit 0
    ;;
  *)
    echo "[오류] 잘못된 입력입니다."
    exit 1
    ;;
esac

echo
echo "[완료] 상태 확인: docker compose --env-file ../../.env ps"
"${DC[@]}" ps
