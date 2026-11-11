# DB 연동 기록 — DH mes_dashboard → NCP Postgres

## 메타

| 항목 | 내용 |
|------|------|
| 날짜 | 2026-11-10 |
| 담당 폴더 | DH |
| 기능명 | mes_dashboard 원격 PG (NCP) |
| 기능표 링크 | (해당 시 DH 기능표) |
| DB 종류 | PostgreSQL (NCP Server, Docker `postgres:18.6` 예정) |
| DB 식별 | 호스트 `49.50.143.236`, DB명 `aiax`, 스키마 `mes` 등 |
| 목적 | 로컬 `127.0.0.1` 대신 공용 NCP PG에 DH API·대시보드 접속 |

## 테이블·연동

| 테이블명 | 주요 컬럼 | 읽기/쓰기 | 연동 화면·API | 비고 |
|----------|-----------|-----------|---------------|------|
| `mes.investment_casting` 등 | mes 스키마 조회 컬럼 | 읽기 | `DH/api/mes_dashboard`, 대시보드 | 계정 `app_lake` |

## 접속 설정 (비밀 값 제외)

| 항목 | 내용 |
|------|------|
| URL 위치 | 프로젝트 루트 `.env` → `DATABASE_URL` |
| 호스트 | `49.50.143.236` |
| 포트 | `5432` |
| DB | `aiax` |
| 계정 | `app_lake` |
| 비밀번호 | 루트 `.env`의 `APP_LAKE_PASSWORD`와 동일 (기록 파일에 평문 없음) |
| 관리자 | `shift` (`POSTGRES_USER`) |

## 메모

- 스키마·init 원본: `MS/db/init/` (계정: `app_mes` / `app_spark` / `app_mart` / `app_lake`).
- 서버 설치 절차: [`DH/전달사항/NCP_Postgres_수동설치.md`](../DH/전달사항/NCP_Postgres_수동설치.md).
- NCP에는 Postgres만. Kafka/Spark/Flink는 서버에 두지 않음.
- ACG: 22·5432는 허용 IP만.
- Postgres 컨테이너 기동 전에는 DH 원격 접속 실패가 정상.
