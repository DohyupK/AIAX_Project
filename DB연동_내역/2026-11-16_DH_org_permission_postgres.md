# DB 연동 기록 — 조직·권한 Postgres `org`

## 메타

| 항목 | 내용 |
|------|------|
| 날짜 | 2026-11-16 |
| 담당 폴더 | DH |
| 기능명 | 조직·권한·게이트·근태 |
| DB 종류 | PostgreSQL (기존 NCP `aiax-postgres`) |
| 위치 | DB `aiax` · schema `org` |

## 요약

- SQLite와 동일 구조 DDL → `01_org_permission_schema.pg.sql` / init `09`
- 시드 DML → `02_org_permission_seed.pg.sql` / init `10` (로직 모듈 계산값 포함)
- 쓰기: `shift`. 조회: `app_lake` (USAGE+SELECT on `org`)
- 규칙 런타임: `DH/api/common/org_permission_logic.py`
- 문서: [`조직권한_인수인계.md`](조직권한_인수인계.md) · [`조직권한_테이블구조.md`](조직권한_테이블구조.md)
- 볼륨 삭제·컨테이너 재생성 없음. 로컬 SQLite 폐기.
