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

## 노션 리포트 연동

루트 `.env`에 채울 값:

| 키 | 용도 |
|----|------|
| `NOTION_TOKEN` | Integration 시크릿 (`ntn_…`) |
| `NOTION_PARENT_PAGE_ID` | 경영·보호구 리포트가 붙는 공통 부모 페이지 |

Integration을 위 부모 페이지에 연결해야 합니다.

### 일일 경영 리포트 (자동)

매일 1회 어제(KST) 리포트를 부모 아래 페이지로 생성·갱신합니다. 같은 제목이면 본문만 갈아끼웁니다.

```bash
# 서버 크론 / Windows 작업 스케줄러 예 (매일 08:05)
curl -sS -X POST http://127.0.0.1:8000/api/report/notion/daily
```

특정일 재전송:

```bash
curl -sS -X POST http://127.0.0.1:8000/api/report/notion/daily \
  -H "Content-Type: application/json" \
  -d "{\"date\":\"2026-11-19\"}"
```

### 보호구 착용 위반 보고서 (수동)

화면 「노션으로 보내기」 → `POST /api/ppe/notion` `{ "month": "YYYY-MM" }`.
