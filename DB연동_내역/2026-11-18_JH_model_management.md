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
| `ai.model_registry` | `model_registry_idx`, `model_name`+`version`(PK), `process_code`, `description`, `file_name`, `file_path`(서버 저장 경로, 화면 미사용), `deployed`, `created_at` | 읽기 | `GET /api/models` (전체), `api/casting/model.py` (CAST-QC1 배포 행 → 품질 검사 1차 모델 파일) | 배포 시 같은 공정 기존 배포 해제 = DB 트리거 `trg_model_registry_deploy` |
| `ai.model_metric_cast_qc1` | `pr_auc_score`, `recall_score`, `precision_score`, `f1_score` | 읽기 | `GET /api/models` (CAST-QC1 행에 LEFT JOIN) | 화면 「품질 1차 검사」 |
| `ai.model_metric_cast_qc2` | `accuracy_score`, `recall_score`, `precision_score`, `f1_score` | 읽기 | 위 (CAST-QC2) | 화면 「품질 2차 검사」 |
| `ai.model_metric_safe_ppe` | `accuracy_score`, `recall_score`, `precision_score`, `f1_score` | 읽기 | 위 (SAFE-PPE) | 화면 「보호구 착용 위반」 |
| `ai.model_robustness` | `model_name`+`version`+`condition_name`(PK, FK → model_registry ON DELETE CASCADE), `accuracy_score`, `recall_score`, `precision_score`, `f1_score` (0~1) | 읽기 | `GET /api/models/{idx}/robustness` | 2026-11-19 추가. 화면 품질 2차 「강건성」 팝업 — 원본 줄은 `model_metric_cast_qc2` 값 |

## 메모

- **코드 ↔ 화면 이름**: CAST-QC1 = 품질 1차 검사, CAST-QC2 = 품질 2차 검사, SAFE-PPE = 보호구 착용 위반. (2026-11-18 MS 가 CAST-OPT·CAST-QC·SAFE-GATE 와 지표 테이블 이름을 변경 → JH 코드 맞춤. 리포 `MS/db/init/11_ai.sql` 은 아직 이전 이름)
- **배포 모델 = 실제 사용 모델**: 품질 1차 배포 행의 `file_name`(TM/model 안 .pkl 만 허용)을 품질 검사 1차 판정에 사용. 미등록이면 기본 `DieCasting_XGB_20261114_09` (결정 1a). 품질 2차·보호구는 이름 표시만(DL 미연결 / 판정은 현장 카메라).
- 확인값(2026-11-18): 네 테이블 0행 → 화면 「등록된 모델 없음」, 품질 검사 1차는 기본 모델.
- **품질 2차 모델 등록 SQL (2026-11-19)**: TM 회신 기준 `DieCasting_CNXV2T_20261117_01`/`v1` CAST-QC2 배포 등록 + 지표 + 강건성 14행 — [JH/전달사항/sql/2026-11-19_qc2_model_register.sql](../JH/전달사항/sql/2026-11-19_qc2_model_register.sql), MS·DH 관리자 계정 실행 대기
- **쓰기 없음**: app_lake 에 ai INSERT·UPDATE 권한 없음(쓰기 권한 보유 역할 없음) → 공정 최적화 등록·배포 버튼 막힘. 요청: [JH/전달사항/2026-11-18_MS_모델레지스트리_쓰기계정_요청.md](../JH/전달사항/2026-11-18_MS_모델레지스트리_쓰기계정_요청.md)
