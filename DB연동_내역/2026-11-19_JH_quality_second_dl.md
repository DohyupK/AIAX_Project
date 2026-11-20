# DB 연동 — 품질 검사 2차(DL) 검사 (JH)

## 메타

| 항목 | 내용 |
|------|------|
| 날짜 | 2026-11-19 |
| 담당 폴더 | JH |
| 기능명 | 품질 검사 대시보드 (`quality_inspection`) 2차(DL) 검사 |
| 기능표 링크 | [JH/기능표.md](../JH/기능표.md#품질-검사-대시보드-quality_inspection) |
| DB 종류 | PostgreSQL (NCP `aiax`) |
| 계정 | `app_lake` (읽기 전용, 루트 `.env` `DATABASE_URL`) |
| 목적 | 샷 이미지를 TM DL 모델(`DieCasting_CNXV2T_20261117_01.onnx`)로 2차 판정해 화면에 표시 |

## 테이블·연동

| 테이블명 | 주요 컬럼 | 읽기/쓰기 | 연동 화면·API | 비고 |
|----------|-----------|-----------|---------------|------|
| `mes.casting_image` | `casting_id`(PK), `image_base64`, `content_type`, `updated_at` | 읽기 | 백그라운드 판정(`image_base64` 32장씩) · `GET /api/casting/second?line=&date=`(`casting_id`·`updated_at` 만) | Kafka→Flink 수집 이미지 (장당 수백 KB — 화면 API 는 이미지 본문을 읽지 않음). `original_uri`·`created_at` 미사용 |
| `mes.investment_casting` | `casting_id`, `line_unit`, `"timestamp"`(날짜) | 읽기 | 위 (라인·날짜로 이미지 샷 찾기) | 1차와 같은 테이블 |
| `ai.model_registry` | `process_code`=`CAST-QC2`, `deployed`, `model_name`, `version`, `file_name` | 읽기 | 위 (`casting/dl_model.py`) | 배포 모델 없으면 기본 `DieCasting_CNXV2T_20261117_01` |
| `ai.quality_prediction` | `casting_id`(PK·FK), `model_name`+`version`(FK → registry), `result`('pass'/'fail'), `confidence_score`(0~1), `predicted_at` | **쓰기** (2026-11-20, 계정 `app_ai` = 루트 `.env` `AI_DATABASE_URL`) | 백그라운드 작업 `dl_model.start_worker` 가 쓰기 / `GET /api/casting/second` 는 읽기만(app_lake, `pending` 포함) | (2026-11-20) 2차 칸만 UPSERT, `qc1_*` 미변경, 1차 불량 줄 건너뜀. **레지스트리 배포 모델일 때만** 저장(기본 모델은 FK 불가). 대상 = 결과 없음·모델 다름·`predicted_at < casting_image.updated_at`, 최근 사진부터 32장씩, 대기 30초. 메모리 캐시 삭제 |

## 메모

- **모델 형식** (TM 문서 `TM/model_dl/DieCasting_CNXV2T_20261117_01/DieCasting_CNXV2T_20261117_01_METRICS.md`): 입력 `image` uint8 [N,H,W,3] RGB 픽셀 그대로, 출력 `prob` = 불량 확률, **0.5 이상 불량**.
- **2차 대상** = 1차 양품 샷 (DB 설명과 같음). 1차 거르기는 화면에서, API 는 이미지 있는 샷 전부 판정.
- 확인값(2026-11-19): 이미지 5장 모두 2026-11-30 (line_no1 2·line_no2 2·line_no3 1), 384×384 PNG. `261130_000046_33` 불량 0.835(실제 판정 양품), 나머지 4장 양품 0.003~0.014.
- **저장하려면**: 쓰기 계정 + `ai.quality_prediction` INSERT 권한. 외래키 때문에 쓴 모델이 `ai.model_registry` 에 먼저 등록돼 있어야 함(지금 기본 모델은 미등록). 요청: [JH/전달사항/2026-11-18_MS_모델레지스트리_쓰기계정_요청.md](../JH/전달사항/2026-11-18_MS_모델레지스트리_쓰기계정_요청.md)
