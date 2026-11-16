# DB 연동 기록 — JH / 공정 최적화 대시보드

## 메타

| 항목 | 내용 |
|------|------|
| 날짜 | 2026-11-06 |
| 담당 폴더 | JH |
| 기능명 | 공정 최적화 대시보드 (process_optimization) — 2026-11-11 온도 제어에서 개편 |
| 기능표 링크 | [JH/기능표.md](../JH/기능표.md) |
| DB 종류 | 목업 JSON (SQLite 아님, DB 연결 없음) |
| DB 상대경로 | `JH/frontend/common/casting/mock/` (shots.json, model.json) |
| 목적 | 화면 확인용. 원본 Investment_Casting.csv 에서 추출 |

## 테이블·연동

| 테이블명 | 주요 컬럼 | 읽기/쓰기 | 연동 화면·API | 비고 |
|----------|-----------|-----------|---------------|------|
| (목업) shots | shotId, time, prob, actual, features | 읽기 | `/casting/process-optimization` | 실제 전환 시 `GET /api/casting/predictions` |
| (목업) model | name, version, auc, threshold, importance, bands | 읽기 | 동일 | 실제 전환 시 `GET /api/models/active?process=casting` (Model Management 공유) |

---

# DB 연동 기록 — JH / 메인 대시보드 (2026-11-07)

| 항목 | 내용 |
|------|------|
| 담당 폴더 | JH |
| 기능명 | 메인 대시보드 (main_dashboard) |
| DB 종류 | 없음. 공지·일정은 코드 하드코딩, 메모는 브라우저 localStorage |
| 저장 위치 | `JH/frontend/pages/main_dashboard/data.ts`, localStorage 키 `jh.main_dashboard.memos` (값: `{ "YYYY-MM-DD": "메모" }`) |
| 이관 메모 | 정식 DB 전환 시 `notices`, `company_events`, `user_memos(user_id, memo_date, content)` 테이블 후보 |

---

# DB 연동 기록 — JH / 작업자 안전 관리 대시보드 (2026-11-07)

| 항목 | 내용 |
|------|------|
| 담당 폴더 | JH |
| 기능명 | 작업자 안전 관리 대시보드 (worker_safety) |
| DB 종류 | 없음. 검색대 기록 목업을 코드에 하드코딩 |
| 저장 위치 | `JH/frontend/pages/worker_safety/data.ts` (`SCAN_RECORDS`) |
| 이관 메모 | 정식 DB 전환 시 `gate_scan_logs(scan_id, scanned_at, user_id, gate, camera, detected_gears, result)`, `companies(company_id, name, type)` 테이블 후보. 판정은 `rules.ts` 기준과 동일하게 |
