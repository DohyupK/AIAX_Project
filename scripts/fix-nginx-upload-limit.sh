#!/usr/bin/env bash
# 사내 문서함 413 Request Entity Too Large — nginx client_max_body_size 25m
# 서버에서: bash /root/AIAX_Project/scripts/fix-nginx-upload-limit.sh
set -euo pipefail

CONF="${NGINX_SITE_CONF:-/etc/nginx/sites-enabled/gknushift}"

if [[ ! -f "$CONF" ]]; then
  echo "conf 없음: $CONF" >&2
  exit 1
fi

if grep -qE 'client_max_body_size[[:space:]]+25m' "$CONF"; then
  echo "이미 client_max_body_size 25m 있음: $CONF"
else
  # location /api/ { 바로 다음에 한도 삽입 (없으면 server 블록 상단에 추가)
  if grep -qE 'location[[:space:]]+/api/' "$CONF"; then
    # GNU sed: location /api/ { 다음 줄에 삽입
    sed -i '/location[[:space:]]\+\/api\//a\    client_max_body_size 25m;' "$CONF"
    echo "location /api/ 에 client_max_body_size 25m 추가: $CONF"
  else
    echo "location /api/ 를 찾지 못함 — $CONF 를 수동으로 확인하세요." >&2
    exit 1
  fi
fi

nginx -t
systemctl reload nginx
echo "nginx reload 완료. 1MB 초과 이미지로 문서함 업로드를 다시 시도하세요."
