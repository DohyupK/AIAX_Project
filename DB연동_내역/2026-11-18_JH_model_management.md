# DB 연동 — Model Management (JH)

## 메타

| 항목 | 내용 |
|------|------|
| 날짜 | 2026-11-18 |
| 담당 폴더 | JH |
| 기능명 | Model Management (`model_management`) 세 탭 + 배포 모델을 쓰는 화면 (품질 검사 1차·2차, 보호구 착용 위반) |
| 기능표 링크 | [JH/기능표.md](../JH/기능표.md#model-management-model_management) |
| DB 종류 | PostgreSQL (NCP `aiax`) |
| 계정 | `app_lake` (읽기 전용, 루트 `.env` `DATABASE_URL`) |
| 목적 | 화면 목업(모델 56건·localStorage 배포)을 서버 모델 레지스트리로 교체 |

## 테이블·연동

| 테이블명 | 주요 컬럼 | 읽기/쓰기 | 연동 화면·API | 비고 |
|----------|-----------|-----------|---------------|------|
| `ai.model_registry` | `model_registry_idx`, `model_name`+`version`(PK), `process_code`, `description`, `file_name`, `deployed`, `created_at` | 읽기 | `GET /api/models` (전체), `api/casting/model.py` (CAST-OPT 배포 행 → 품질 검사 1차 모델 파일) | 배포 시 같은 공정 기존 배포 해제 = DB 트리거 `trg_model_registry_deploy` |
| `ai.model_metric_cast_opt` | `pr_auc_score`, `recall_score`, `precision_score`, `f1_score` | 읽기 | `GET /api/models` (CAST-OPT 행에 LEFT JOIN) | 화면 「품질 1차 검사」 |
| `ai.model_metric_cast_qc` | `accuracy_score`, `recall_score`, `precision_score`, `f1_score` | 읽기 | 위 (CAST-QC) | 화면 「품질 2차 검사」 |
| `ai.model_metric_safe_gate` | `accuracy_score`, `recall_score`, `precision_score`, `f1_score` | 읽기 | 위 (SAFE-GATE) | 화면 「보호구 착용 위반」 |

## 메모

- **코드 ↔ 화면 이름** (사용자 결정 2a: 코드 유지): CAST-OPT = 품질 1차 검사, CAST-QC = 품질 2차 검사, SAFE-GATE = 보호구 착용 위반.
- **배포 모델 = 실제 사용 모델**: 품질 1차 배포 행의 `file_name`(TM/model 안 .pkl 만 허용)을 품질 검사 1차 판정에 사용. 미등록이면 기본 `DieCasting_XGB_20261114_09` (결정 1a). 품질 2차·보호구는 이름 표시만(DL 미연결 / 판정은 현장 카메라).
- 확인값(2026-11-18): 네 테이블 0행 → 화면 「등록된 모델 없음」, 품질 검사 1차는 기본 모델.
- **쓰기 없음**: app_lake 에 ai INSERT·UPDATE 권한 없음(쓰기 권한 보유 역할 없음) → 공정 최적화 등록·배포 버튼 막힘. 요청: [JH/전달사항/2026-11-18_MS_모델레지스트리_쓰기계정_요청.md](../JH/전달사항/2026-11-18_MS_모델레지스트리_쓰기계정_요청.md)
