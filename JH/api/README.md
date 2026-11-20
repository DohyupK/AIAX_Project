# JH API

실행 (프로젝트 루트 `.env` 사용):

```bash
cd JH/api
uv sync
uv run uvicorn main:app --host 127.0.0.1 --port 8000
```

## DB 접속 (루트 `.env`)

모두 **DB 접속 주소** — `postgresql://계정:비밀번호@호스트:5432/aiax` (웹 주소 `https://…` 아님).
호스트: 서버 `.env` = `127.0.0.1` / 개인 PC `.env` = 서버 IP.

| 키 | 계정 | 쓰는 곳 |
|----|------|---------|
| `DATABASE_URL` | `app_lake` (읽기) | 공정·품질·보호구·리포트·모델 조회 |
| `HR_DATABASE_URL` | `app_hr` | 인사 관리 |
| `DOCS_DATABASE_URL` | `app_docs` | 사내 문서함 |
| `AI_DATABASE_URL` | `app_ai` (쓰기) | 품질 2차(DL) 판정 저장 — 서버 시작 시 백그라운드 작업 (`casting/dl_model.py`). 비밀번호 = MS 가 만든 `app_ai` 비밀번호 |

형식이 틀리면 로그에 `루트 .env 의 … 는 DB 접속 주소여야 합니다` (값은 출력하지 않음).

## 노션 · 슬랙 리포트 연동

루트 `.env`:

| 키 | 용도 |
|----|------|
| `NOTION_TOKEN` | Integration 시크릿 (`ntn_…`) |
| `NOTION_PARENT_PAGE_ID` | 공통 부모 페이지 **ID** (32자 hex). URL도 서버가 정규화 |
| `SLACK_BOT_TOKEN` | **Bot User OAuth Token (`xoxb-…`)** |
| `SLACK_REPORT_CHANNEL_ID` | 「보고」채널 ID (예: `C0CK4R2M1FH`) |

토큰 종류:

| 앞글자 | 용도 | 채널 리포트 |
|--------|------|-------------|
| `xoxb-` | Bot User OAuth Token | **사용** |
| `xoxp-` / `xoxe.xoxp-` | User OAuth Token | 가능(User scopes) |
| `xapp-` | App-Level Token (Socket Mode) | **금지** |

노션: Integration을 부모 페이지에 연결.  
슬랙 ([api.slack.com/apps](https://api.slack.com/apps) → OAuth & Permissions):

- 페이지 **위** OAuth Tokens → **Bot User OAuth Token** (`xoxb-`) 복사 (Basic Information의 App-Level/`xapp-` 아님)
- **Bot Token Scopes**: `chat:write` (공개 채널 미참여 시 `chat:write.public`도)
- scope 추가 후 **Reinstall to Workspace** → 새 `xoxb-`를 `.env`에 넣고 JH API 재시작
- 「보고」채널에 봇 **초대**
- `missing_scope` = scope 부족 · `xapp-` 넣으면 서버가 거부

프론트가 원격 API를 쓰면 **서버** `.env`에도 같은 값을 넣고 JH API를 재시작.

### 일일 경영 리포트

| 방식 | 엔드포인트 |
|------|------------|
| 크론 (보낼 곳 하나) | `POST /api/report/push/daily` — body `target`: `notion`(기본) \| `slack` |
| 노션만 | `POST /api/report/notion/daily` |
| 슬랙만 | `POST /api/report/slack/daily` |

기본 대상일 = 어제(KST). 화면은 보낼 곳 라디오(노션/슬랙) + 「보내기」. body `{ "date": "YYYY-MM-DD" }` 로 특정일.

```bash
# 서버 크론 — 기본 노션만
curl -sS -X POST http://127.0.0.1:8000/api/report/push/daily
# 슬랙만
curl -sS -X POST http://127.0.0.1:8000/api/report/push/daily \
  -H "Content-Type: application/json" -d "{\"target\":\"slack\"}"
```

### 보호구 착용 위반 보고서 (수동)

화면에서 보낼 곳(노션/슬랙) 선택 후 「보내기」.

- 노션: `POST /api/ppe/notion` `{ "month": "YYYY-MM" }`
- 슬랙: `POST /api/ppe/slack` `{ "month": "YYYY-MM" }`
