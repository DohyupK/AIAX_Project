# Spark 규칙 — `mes.casting_image` → `lake.lake_casting_image`

작성: DH (2026-11-19). 실행 잡 위치 관례: `MS/db/spark/jobs/` (2차 연결).

## 트리거

1. mes INSERT/UPDATE 성공 후 Kafka 토픽 `aiax.image.spark_sync` 에 신호  
   메시지 예: `{"casting_id":"260804_070411_1","op":"upsert"}`
2. Spark(또는 동등 소비자)가 신호를 받으면 **해당 casting_id 최신 1건만** lake 에 upsert

## 하지 않는 것

- 테이블 전체 풀스캔 일상 복제 (이 테이블은 **갱신된 건만**)
- `original_uri` 로 파일 재다운로드 (원본은 곧 삭제됨 — **금지**)
- 일일 `lake_sync`/`lake_runner` 와 역할 혼동 (주조 수치 배치와 **별개**)

## SQL (뼈대와 동일)

`payload.UPSERT_LAKE_SQL` — `casting_id` 바인딩 1개.

## 계정

- 읽기 mes: `app_spark` (SELECT)
- 쓰기 lake: `app_spark`

## 성공 조건

`lake.lake_casting_image` 에 동일 `casting_id` 행이 있고 `lake_synced_at` 이 갱신됨.
