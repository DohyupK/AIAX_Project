# 전달사항 — 보호구 모델 지표 칼럼 `map50_score` 레포 init 반영 요청 (JH → MS)

- 작성: JH, 2026-11-20
- 대상: MS (DB·`ai` 스키마, `MS/db/init/`)
- 관련: PR #39 (JH 코드 수정), [DB연동_내역/2026-11-18_JH_model_management.md](../../DB연동_내역/2026-11-18_JH_model_management.md)

## 요약

서버 DB 의 `ai.model_metric_safe_ppe` 는 **`map50_score`** (보호구 검출 모델 mAP50) 로 바뀌었는데, 레포 **`MS/db/init/11_ai.sql` 은 아직 `accuracy_score`** 입니다. 레포만으로 DB 를 새로 만들면 예전 칼럼으로 생겨 JH API 가 다시 503 이 나므로, 레포 파일을 서버와 맞춰 주세요.

## 현재 상태 (2026-11-20 확인)

| | 보호구 지표 테이블 칼럼 | 테이블 설명 |
|---|---|---|
| **서버 DB** | `model_name`, `version`, **`map50_score`**, `recall_score`, `precision_score`, `f1_score` (4행 — YOLO 모델 4개) | 「보호구 착용 위반(SAFE-PPE) 검출 모델 성과지표 — mAP50·Recall·Precision·F1」 |
| **레포 `11_ai.sql` 102~112줄** | `model_name`, `version`, **`accuracy_score`**, `recall_score`, `precision_score`, `f1_score` | 「안전구 착용 위반(SAFE-PPE) 모델 성과지표」 |

- 레포 전체에 `map50` 이 한 곳도 없음 → 서버에 적용한 변경(칼럼 이름 변경 SQL)이 레포에 기록되지 않은 상태
- 이 차이로 11-20 배포 서버에서 JH `/api/models`·`/api/models/deployed` 가 503 (JH 코드는 PR #39 로 `map50_score` 에 맞춤)

## 요청

| # | 요청 | 이유 |
|---|------|------|
| 1 | `MS/db/init/11_ai.sql` 의 `ai.model_metric_safe_ppe` 를 서버와 같게: `accuracy_score` → **`map50_score`** (CHECK 0~1 포함), 테이블 설명도 서버 문구로 | 새로 만든 DB 가 서버와 같은 구조여야 JH API 가 동작 |
| 2 | 서버에 실제로 실행한 변경 SQL(예: `ALTER TABLE … RENAME COLUMN accuracy_score TO map50_score`)이 있으면 번호 붙여 `MS/db/init/` 에 추가 | 이미 만들어진 다른 DB(팀원 로컬 등)도 같은 순서로 맞출 수 있게 |
| 3 | `DB구조.md` 의 `ai.model_metric_safe_ppe` 설명 갱신 | 팀원이 문서로 실제 구조를 알 수 있게 |
| 4 | (확인) 다른 지표 테이블(`model_metric_cast_qc1`·`_cast_qc2`)·`model_robustness` 도 서버와 레포가 같은지 | JH API 가 칼럼 이름을 직접 읽어 하나라도 다르면 Model Management 전체가 실패 |

## 참고 — JH 가 읽는 칼럼 (바꾸기 전에 알려 주세요)

| 테이블 | JH 가 읽는 칼럼 |
|---|---|
| `ai.model_metric_cast_qc1` | `pr_auc_score`, `recall_score`, `precision_score`, `f1_score` |
| `ai.model_metric_cast_qc2` | `accuracy_score`, `recall_score`, `precision_score`, `f1_score` |
| `ai.model_metric_safe_ppe` | `map50_score`, `recall_score`, `precision_score`, `f1_score` |
| `ai.model_robustness` | `condition_name`, `accuracy_score`, `recall_score`, `precision_score`, `f1_score` |

칼럼 이름을 바꿀 일이 있으면 미리 JH 에 알려 주시면 코드를 같이 맞추겠습니다 (서버만 먼저 바뀌면 페이지가 바로 503).
