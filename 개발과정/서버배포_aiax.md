# aiax 서버 배포·기동 (성공본, 2026-11-17)

| 항목 | 내용 |
|------|------|
| 서버 | NCP Ubuntu `aiax` (`/root/AIAX_Project`) |
| 사이트 | `https://gknushift.freemyip.com` |
| 담당 | DH (루트 운영). JH FastAPI 앱 코드는 기존 구현 사용 |
| 관련 | [`scripts/dev-up.sh`](../scripts/dev-up.sh), [`데이터파이프라인.md`](데이터파이프라인.md) (NCP=Postgres+앱) |

**다음 배포 시 이 문서 + 예시 파일만 보면 된다.** Windows PC용 `.env`와 서버 `.env`를 섞지 말 것.

---

## 1. 한 줄로 기동

```bash
systemctl restart myapp
```

- Next.js **:3000** + JH FastAPI **:8000** 이 tmux 세션 `myapp`에 같이 뜬다.
- 로그: `tmux attach -t myapp` → `Ctrl+b n` (창 전환) → `Ctrl+b d` (나가기)
- 창 이름: `next`, `api`

부팅 후 자동: `systemctl enable myapp`

---

## 2. 다중 포트가 동시에 뜨는 원리

```text
systemctl restart myapp
  → ExecStart = /root/AIAX_Project/scripts/dev-up.sh
  → tmux 세션 myapp
       ├─ window next  → cwd 프로젝트 루트 → pnpm dev          → :3000
       └─ window api   → cwd JH/api        → uv run uvicorn … → :8000 (127.0.0.1만)
브라우저
  → nginx (443)
       ├─ location /     → 127.0.0.1:3000
       └─ location /api/ → 127.0.0.1:8000
JH API
  → Postgres docker 127.0.0.1:5432  (서버 .env 의 DATABASE_URL / HR_DATABASE_URL)
```

JH 폴더의 FastAPI·프론트 fetch 코드는 **이미 있던 것**. 이번 배포에서 바꾼 것은 루트 `scripts/`·systemd·nginx·서버 `.env`이다.

---

## 3. systemd unit (서버 성공본)

파일: `/etc/systemd/system/myapp.service`  
레포 예시: [`scripts/myapp.service.example`](../scripts/myapp.service.example)

```ini
[Unit]
Description=AIAX Next(:3000) + JH API(:8000) via tmux myapp
After=network.target docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/root/AIAX_Project
Environment=PATH=/root/.local/bin:/usr/local/bin:/usr/bin:/bin
ExecStart=/root/AIAX_Project/scripts/dev-up.sh
ExecStop=/usr/bin/tmux kill-session -t myapp

[Install]
WantedBy=multi-user.target
```

적용:

```bash
chmod +x /root/AIAX_Project/scripts/dev-up.sh
cp /root/AIAX_Project/scripts/myapp.service.example /etc/systemd/system/myapp.service
systemctl daemon-reload
systemctl enable --now myapp
systemctl status myapp --no-pager
tmux list-windows -t myapp
```

성공 시 status는 `active (exited)`, 창은 `next` / `api` 두 개.

**왜 oneshot + PATH인가**

- `uv`는 `/root/.local/bin/uv` — systemd 기본 PATH에 없음 → 없으면 `dev-up.sh` exit 1
- `Type=forking` + 셸 스크립트는 실패·재시작 루프가 났음 → `oneshot` + `RemainAfterExit=yes`

---

## 4. nginx (성공본 요지)

사이트: `/etc/nginx/sites-enabled/gknushift`  
스니펫: [`scripts/nginx-api.snippet.conf`](../scripts/nginx-api.snippet.conf)

443 `server` 블록 안에:

- `location /` → `proxy_pass http://127.0.0.1:3000;` (기존 Next, Upgrade 헤더 유지)
- `location /api/` → `proxy_pass http://127.0.0.1:8000/api/;` (JH FastAPI)

Certbot이 관리하는 `listen 80` 블록은 건드리지 않음.

```bash
nginx -t && systemctl reload nginx
```

---

## 5. 서버 루트 `.env` (성공본 요지)

비밀번호는 이 문서에 적지 않는다. 패턴만:

| 키 | 서버 값 |
|----|---------|
| `DATABASE_URL` | 호스트 **`127.0.0.1`** (docker Postgres). 공인 IP면 서버에서 타임아웃·503 |
| `HR_DATABASE_URL` | 동일하게 호스트 **`127.0.0.1`** |
| `NEXT_PUBLIC_API_BASE_URL` | `https://gknushift.freemyip.com` (또는 비워서 same-origin) |
| `NEXT_PUBLIC_HR_API_BASE_URL` | 위와 동일 |
| `DOCUMENT_ROOT` | **`/document`** (사내 문서함 파일, 프로젝트 밖) |
| `DOCS_DATABASE_URL` | `app_docs@127.0.0.1` (org 문서·청크·임베딩 쓰기) |
| `OPENAI_API_KEY` | Embeddings용 `sk-...` ([platform.openai.com](https://platform.openai.com/api-keys)). 비우면 업로드만 되고 청크 임베딩·검색 실패 |

스니펫: [`scripts/server-env.snippet.env`](../scripts/server-env.snippet.env) (문서함 키 주석 포함)

`.env` 변경 후 반드시:

```bash
systemctl restart myapp
```

Windows PC의 `.env`는 공인 IP 등을 쓸 수 있음 — **서버 파일과 동기화로 덮어쓰지 말 것.**

---

## 6. 검증 명령

```bash
curl -s -o /dev/null -w "next:%{http_code}\n" http://127.0.0.1:3000/
curl -s -o /dev/null -w "docs:%{http_code}\n" http://127.0.0.1:8000/docs
curl -sk -o /dev/null -w "via-nginx:%{http_code}\n" \
  "https://gknushift.freemyip.com/api/casting/dates?line=line_no1"
```

기대: next/docs **200**, via-nginx **200** (DB 실패 시 프록시는 되고 API가 **503**).

화면: `https://gknushift.freemyip.com/casting/process-optimization`, `/hr`

---

## 7. 트러블슈팅 (실제로 겪은 것)

| 증상 | 원인 | 조치 |
|------|------|------|
| `myapp` exit 1, tmux 없음 | systemd PATH에 `uv` 없음 | unit에 `Environment=PATH=/root/.local/bin:...` |
| 재시작 폭풍 | `Type=forking` + `Restart=on-failure` | `oneshot` + `RemainAfterExit=yes`, Restart 제거 |
| `direct:000` | uvicorn 미기동·기동 중 | `tmux capture-pane -t myapp:api -p`, 수초 후 재시도 |
| `via-nginx:404` | `location /api/` 없음 | gknushift conf에 추가 후 reload |
| `via-nginx:503` | DB URL 호스트가 공인 IP | 서버 `.env`를 `127.0.0.1`로 바꾼 뒤 restart |
| 문서 업로드 `ConnectionTimeout` / `/api/documents` 500(~10s) | `DOCS_DATABASE_URL` 호스트가 공인 IP (`49.50…`). HR 등 `127.0.0.1`은 정상 | 서버 `.env`만 `DOCS`→`127.0.0.1`, `DOCUMENT_ROOT=/document` 후 `systemctl restart myapp`. 원커맨드: `bash scripts/fix-docs-db-host.sh` |
| 원격 화면 API 실패 | `NEXT_PUBLIC_*=127.0.0.1` | 도메인 또는 빈 값 (브라우저의 127.0.0.1은 PC) |

```bash
journalctl -u myapp -n 40 --no-pager
systemctl cat myapp
grep -n "location /api" /etc/nginx/sites-enabled/gknushift
```
