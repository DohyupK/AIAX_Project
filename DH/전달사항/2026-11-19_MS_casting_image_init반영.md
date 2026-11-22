# 전달사항 — casting_image 테이블 init·Spark 반영 (DH → MS)

- 작성: DH, 2026-11-19
- 대상: MS (`MS/db/init/`, `MS/db/spark/jobs/`)
- 상태: DH 뼈대 SQL·규칙 작성 완료. **init 번호 편입·서버 적용·Spark 잡 구현** 요청

## 요청

1. [`DH/data/sql/03_casting_image.pg.sql`](../data/sql/03_casting_image.pg.sql) 내용을 `MS/db/init/` 에 번호 규칙에 맞게 반영 (예: mes/org/ai 이후).
2. 서버 `aiax` 에 동일 DDL 적용 (DH 전권·위임 — 절차만 MS 관례에 맞춤).
3. Spark: [`DH/api/image_pipeline/spark_rules.md`](../api/image_pipeline/spark_rules.md)  
   - 토픽 `aiax.image.spark_sync` 수신 시 **해당 casting_id 최신건만** `mes.casting_image` → `lake.lake_casting_image` upsert  
   - 기존 일일 `lake_sync` 와 **별개** 잡으로 둘 것

## 테이블

- `mes.casting_image` (PK/FK `casting_id` → `mes.investment_casting`)
- `lake.lake_casting_image`

## 계정

- mes 쓰기: `app_mes`
- lake 쓰기: `app_spark`

## 참고

파이프·토픽·E1a·모드 A/B: [`DH/지침_image_pipeline_임시.md`](../지침_image_pipeline_임시.md)
