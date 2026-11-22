#!/usr/bin/env bash
# 사내 문서함 「문서 내용 보기」용 변환 도구 설치 — docx·xlsx·pptx → PDF (LibreOffice headless) + 한글 글꼴
# 승인: JH/전달사항/2026-11-20_LibreOffice_승인요청.md (승인 후에만 실행)
#
# 실행 (서버 aiax, root):  bash /root/AIAX_Project/JH/api/documents/install_office_convert.sh
# - 이미 설치돼 있으면 설치를 건너뛰고 변환 시험만 함 (다시 실행해도 안전)
# - 설치 후 JH API 를 다시 켤 필요 없음: 변환 시점마다 soffice 를 찾음 (documents/preview.py)
# - 되돌리기: apt-get remove -y libreoffice-core libreoffice-writer libreoffice-calc libreoffice-impress fonts-nanum && apt-get autoremove -y
set -euo pipefail

PKGS=(libreoffice-core libreoffice-writer libreoffice-calc libreoffice-impress fonts-nanum)

if [[ "$(id -u)" -ne 0 ]]; then
  echo "root 로 실행하세요 (apt 설치 권한 필요)." >&2
  exit 1
fi
if ! command -v apt-get >/dev/null; then
  echo "apt-get 이 없습니다 — Ubuntu/Debian 서버용 스크립트입니다." >&2
  exit 1
fi

missing=()
for p in "${PKGS[@]}"; do
  dpkg -s "$p" >/dev/null 2>&1 || missing+=("$p")
done

if ((${#missing[@]})); then
  echo "[1/3] 설치: ${missing[*]}"
  apt-get update -qq
  # --no-install-recommends: 데스크톱 화면·도움말 등 추천 패키지 제외 (서버 변환에 불필요, 용량 절약)
  DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends "${missing[@]}"
  fc-cache -f >/dev/null
else
  echo "[1/3] 이미 설치됨: ${PKGS[*]}"
fi

SOFFICE="$(command -v soffice || command -v libreoffice || true)"
if [[ -z "$SOFFICE" ]]; then
  echo "soffice 를 찾을 수 없습니다 — 설치 로그를 확인하세요." >&2
  exit 1
fi
echo "[2/3] LibreOffice: $("$SOFFICE" --version 2>/dev/null | head -1)"

# [3/3] 변환 시험 — 한글이 든 텍스트 문서를 PDF 로 (임시 폴더, 서버 문서·프로필에 영향 없음)
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
printf '변환 시험 문서\n사내 문서함 내용 보기\n' > "$tmp/test.txt"
"$SOFFICE" "-env:UserInstallation=file://$tmp/profile" --headless --norestore \
  --convert-to pdf --outdir "$tmp" "$tmp/test.txt" >/dev/null 2>&1 || true
if [[ -s "$tmp/test.pdf" ]]; then
  echo "[3/3] 변환 시험 성공 ($(stat -c %s "$tmp/test.pdf") 바이트) — 문서함에서 docx·xlsx·pptx 원본 모양 보기가 켜집니다."
else
  echo "[3/3] 변환 시험 실패 — '$SOFFICE --headless --convert-to pdf 파일' 을 직접 실행해 오류를 확인하세요." >&2
  exit 1
fi
