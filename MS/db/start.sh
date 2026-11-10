#!/usr/bin/env bash
# aiax-db Docker 기동 메뉴 (Linux — NCP Ubuntu 등)
# compose 파일은 수정하지 않습니다. 선택에 따라 up 대상만 바꿉니다.
set -euo pipefail
cd "$(dirname "$0")"

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
    echo "[실행] docker compose up -d postgres"
    docker compose up -d postgres
    ;;
  2)
    echo
    echo "[실행] docker compose up -d kafka kafka-ui spark-master spark-worker flink-jobmanager flink-taskmanager"
    docker compose up -d kafka kafka-ui spark-master spark-worker flink-jobmanager flink-taskmanager
    ;;
  3)
    echo
    echo "[실행] docker compose up -d"
    docker compose up -d
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
echo "[완료] 상태 확인: docker compose ps"
docker compose ps
