# DB 연동 — 불량 유형 라벨 저장 SQLite (JH)

## 메타

| 항목 | 내용 |
|------|------|
| 날짜 | 2026-11-21 |
| 담당 폴더 | JH |
| 기능명 | 불량 유형 라벨링 (`defect_labeling`) — **저장만** |
| 기능표 링크 | [JH/기능표.md](../JH/기능표.md#불량-유형-라벨링-defect_labeling) |
| DB 종류 | SQLite 목업 (`JH/data/defect_labels.db`, git 제외) |
| 목적 | Postgres `ai.defect_label`/`ai.defect_discard` 쓰기·권한 의존으로 「완료」가 실패하던 문제를, 이 페이지 저장만 서버 로컬 SQLite로 재편 |

## 테이블·연동

| 저장소 | 주요 컬럼 | 읽기/쓰기 | 연동 API | 비고 |
|--------|-----------|-----------|----------|------|
| `JH/data/defect_labels.db` · `defect_label` | `casting_id`(PK), `status`, `blowhole`, `edge_burr`, `surface_rough`, `updated_at`, `updated_by` | 읽기·쓰기 | `POST /api/casting/defects/{id}/label`, `GET /api/casting/defects` 머지 | SoT. stdlib sqlite3 |
| `ai.quality_prediction` + `mes.investment_casting` | fail 샷 목록 | 읽기 (app_lake) | `GET /defect-dates`, `GET /defects` | 목록용. 저장 시 검증 안 함 |
| `ai.defect_label` / `ai.defect_discard` | (기존) | 읽기만 (LEFT JOIN) | `GET /defects` | SQLite 행이 있으면 덮어씀. **쓰기 안 함** |

## 메모

- 코드: `JH/api/casting/defect_label_store.py`, `router.py` `save_label` / `defects`
- 서버에 `JH/data/` 쓰기 권한 필요 (auth.db 와 동일). 백업 대상.
- 정식 Postgres 이관 시 store 함수만 교체하면 됨 (ponytail).
