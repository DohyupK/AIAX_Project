# DB 연동 기록 — 이미지 수집 Flink job (mes.casting_image → lake.lake_casting_image)

## 메타

| 항목 | 내용 |
|------|------|
| 날짜 | 2026-11-19 |
| 담당 폴더 | MS (`MS/db/flink/jobs/image_ingest.py`) — JH 작업, DH·MS 승인 |
| 기능명 | 품질 이미지 수집 (Kafka → Flink → mes → spark_sync → lake) |
| 기능표 링크 | [`DH/기능표.md`](../DH/기능표.md) 이미지 파이프라인 |
| DB 종류 | PostgreSQL (서버 `aiax`) |
| DB 상대경로 | 서버 — 접속은 루트 `.env` |
| 목적 | DH `flink_role_a`(Python) 를 Flink job 으로 이전, 서버 테이블 생성·E2E 검증 |

## 테이블·연동

| 테이블명 | 주요 컬럼 | 읽기/쓰기 | 연동 화면·API | 비고 |
|----------|-----------|-----------|---------------|------|
| `mes.casting_image` | casting_id(PK·FK→investment_casting), content_type, image_base64, original_uri, created_at, updated_at | 쓰기 `app_mes` (Flink job UPSERT) | — | **2026-11-19 서버 생성** (`shift`, DH `03_casting_image.pg.sql` 그대로) |
| `lake.lake_casting_image` | 위 + lake_synced_at | 쓰기 `app_spark` (DH `lake_sync_consumer`), 읽기 `app_lake` | JH 화면 (이후) | 같은 날 같은 SQL 로 생성 |
| `mes.investment_casting` | casting_id | 참조만 (FK) | — | 변경 없음 |

## 메모

- 스키마 변경 이유: 이미지 파이프라인 대상 테이블이 서버에 없어 E2E 불가 → DH DDL 적용 (mes 는 이 테이블만)
- **MS 할 일:** 같은 DDL 을 `MS/db/init/` 에 편입 (새 DB 생성 시 누락 방지)
- 검증 목업 (서버에 남아 있음): `casting_id` 5건 `261130_000046_33`, `261130_000148_343`, `261130_000207_18`, `261130_000307_34`, `261130_000405_344` — 384px 노이즈 PNG, `original_uri = http://mock-pc/...`. 삭제 여부는 사용자 결정 대기
- 서버 실행법: [`JH/전달사항/2026-11-19_DH_이미지수집_Flink_서버실행.md`](../JH/전달사항/2026-11-19_DH_이미지수집_Flink_서버실행.md)
