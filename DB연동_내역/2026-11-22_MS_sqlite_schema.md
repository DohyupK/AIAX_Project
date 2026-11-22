# DB 연동 — 서버 DB 테이블 구조 SQLite 판 (MS)

## 메타

| 항목 | 내용 |
|------|------|
| 날짜 | 2026-11-22 |
| 담당 폴더 | MS |
| 기능명 | 팀 DB(서버 Postgres `aiax`) 테이블 구조를 SQLite 로 옮긴 판 |
| 기능표 링크 | [DB구조.md](../DB구조.md) |
| DB 종류 | SQLite (구조만) |
| DB 상대경로 | `MS/data/aiax_schema.sqlite.sql` (이 SQL 로 `.db` 생성: `sqlite3 aiax_schema.db < aiax_schema.sqlite.sql`) |
| 목적 | AGENTS.md 10항(개인 폴더 `data/` SQLite) 기준 등록 — DH 요청. 실제 운영 DB 는 서버 Postgres 그대로 |

## 테이블·연동

| 범위 | 내용 | 비고 |
|------|------|------|
| 스키마 5개 | `mes`, `lake`, `mart`, `org`, `ai` — 테이블 84개 | 2026-11-22 서버 기준 |
| 이름 | `스키마.테이블` → `스키마_테이블` (예: `mes.investment_casting` → `mes_investment_casting`) | SQLite 에 스키마 없음 |
| 옮긴 것 | 칸·NOT NULL·기본키·UNIQUE·외래키(ON DELETE 포함) | 칸마다 원래 Postgres 타입을 주석으로 남김 |
| 안 옮긴 것 | 트리거·함수·권한(GRANT)·시퀀스·CHECK | 원본은 `MS/db/init` |
| 타입 | 정수 → INTEGER, real·double → REAL, numeric → NUMERIC, boolean → INTEGER(0/1), 날짜·시각 → TEXT, 배열·json → TEXT(JSON), bytea → BLOB, 나머지 TEXT | |

## 메모

- 데이터는 넣지 않음 (구조만). 목업 데이터가 든 `.db` 는 Git 제외 규칙(`*.db`)대로 올리지 않음
- 서버 구조가 바뀌면 다시 생성해서 갱신
