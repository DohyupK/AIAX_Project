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
| `SLACK_BOT_TOKEN` | Bot User OAuth Token (`xoxb-…`) |
| `SLACK_REPORT_CHANNEL_ID` | 「보고」채널 ID (예: `C0CK4R2M1FH`) |

노션: Integration을 부모 페이지에 연결.  
슬랙: 봇을 「보고」채널에 초대 (`chat:write`).  
프론트가 원격 API를 쓰면 **서버** `.env`에도 같은 값을 넣고 JH API를 재시작.

### 일일 경영 리포트

| 방식 | 엔드포인트 |
|------|------------|
| 크론 (노션+슬랙) | `POST /api/report/push/daily` |
| 노션만 | `POST /api/report/notion/daily` |
| 슬랙만 | `POST /api/report/slack/daily` |

기본 대상일 = 어제(KST). body `{ "date": "YYYY-MM-DD" }` 로 특정일(화면 수동).

```bash
# 서버 크론 / Windows 작업 스케줄러 예 (매일 08:05)
curl -sS -X POST http://127.0.0.1:8000/api/report/push/daily
```

### 보호구 착용 위반 보고서 (수동)

- 노션: `POST /api/ppe/notion` `{ "month": "YYYY-MM" }`
- 슬랙: `POST /api/ppe/slack` `{ "month": "YYYY-MM" }`
