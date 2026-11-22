# 로그인·회원가입 계정 저장 (JH, 2026-11-21)

## 메타

| 항목 | 내용 |
|------|------|
| 날짜 | 2026-11-21 |
| 담당 폴더 | JH |
| 기능명 | 로그인·회원가입 (`/login`, `/signup`) |
| 기능표 링크 | [`JH/기능표.md` 로그인·회원가입](../JH/기능표.md#로그인회원가입-auth) |
| DB 종류 | **임시** SQLite (정식 DB 테이블 확정 전) + Postgres `org` 읽기 |
| DB 상대경로 | `JH/data/auth.db` (git 제외, 서버마다 따로 생김) |
| 목적 | 계정(아이디·비밀번호 해시·사번) 저장. 권한은 사번으로 기존 org 규칙 사용 |

## 테이블·연동

| 테이블명 | 주요 컬럼 | 읽기/쓰기 | 연동 화면·API | 비고 |
|----------|-----------|-----------|---------------|------|
| `app_user` (SQLite) | `user_id`(PK, 소문자) · `password_hash`(scrypt) · `employee_no`(UNIQUE) · `user_name` · `email` · `created_at` · `last_login_at` | 읽기·쓰기 | `/api/auth/login`·`/signup` | 비밀번호 원문 저장 안 함 |
| `org.employee` + `org.employee_info` (Postgres, `HR_DATABASE_URL`) | `employee_no`, `employee_name` | 읽기 | `/api/auth/signup` | 사번 존재·이름 일치 확인 |
| `org.hr_access_log` | `viewer_no` | 쓰기 (기존) | 인사 API | 관리자 행동은 `admin:아이디`, 관리자 보기 전환도 `admin:아이디` 로 기록 |

관리자 계정은 DB에 두지 않음 — 루트 `.env` `ADMIN_ID` / `ADMIN_PASSWORD`.

## 메모

- **SQLite 를 쓴 이유:** 로그인·회원가입 DB 테이블·칼럼이 아직 없음 → 기능 먼저 구현하고 그에 맞춰 DB 를 설계하기로 결정 (JH, 2026-11-21). README 의 「개인 폴더 SQLite 목업 폐기」와 별개인 **한시 저장소**.
- **정식 테이블 제안 (MS·DH 검토):** 위 `app_user` 칼럼 그대로 `org.app_user` 등으로. `employee_no` → `org.employee` 외래키, `user_id` UNIQUE(소문자), `password_hash text NOT NULL`. 쓰기 계정 권한(INSERT·UPDATE `last_login_at`) 필요.
- **교체 위치:** `JH/api/auth/store.py` 의 함수 3개(`find_user`·`create_user`·`touch_login`)만 Postgres 로 바꾸면 됨. 화면·다른 API 변경 없음.
- **주의:** 서버의 `JH/data/auth.db` 는 git 에 없으므로 서버 백업 대상. 정식 테이블로 옮길 때 기존 계정 이전 필요.
