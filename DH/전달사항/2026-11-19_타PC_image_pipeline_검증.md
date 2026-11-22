# 타 PC — Docker·이미지 파이프 검증 / 장애 대응 (DH)

이 PC에 Docker 없음 → **검증은 Docker 있는 PC**에서. 1차 확인 후 2차 E2E.

## 사전

1. 프로젝트 pull, 루트 `.env` (APP_MES / APP_SPARK / DB)
2. `MS/db`: `docker compose --env-file ../../.env up -d` (최소 kafka + postgres; 2차는 spark·flink)
3. SQL: `DH/data/sql/03_casting_image.pg.sql` 적용
4. `mes.investment_casting` 에 테스트용 `casting_id` 행 존재 (FK)

## 1차 확인 (라이브러리 없이)

```bash
cd DH
python -m api.image_pipeline.status_server
curl http://127.0.0.1:8765/health
curl http://127.0.0.1:8765/config
curl -X POST http://127.0.0.1:8765/v1/image/ingest/dry-run ^
  -H "Content-Type: application/json" ^
  -d "{\"casting_id\":\"260804_070411_1\",\"image_base64\":\"AQID\",\"original_uri\":\"http://example/x.jpg\"}"
```

기대: `ok: true`, `mode: A`, steps 에 phase2 표시.

## 2차 E2E 체크리스트

**「2차 구현 시작」지시 후에만.** 지금은 참고·할일만 [`../2차_참고목록.md`](../2차_참고목록.md).

- [ ] Kafka UI `localhost:8080` 에 T1 토픽 3개
- [ ] ingest 에 E1a 메시지 publish
- [ ] 모드 A: `mes.casting_image` 행 생김 (`app_mes`)
- [ ] `aiax.image.spark_sync` 신호
- [ ] `lake.lake_casting_image` 동일 casting_id, `lake_synced_at` 갱신
- [ ] `original_uri` 로 HTTP GET 하지 않음

## 장애 대응

| 증상 | 가능한 원인 | 대응 |
|------|-------------|------|
| Kafka 연결 거부 | compose 미기동, 포트 | `docker compose ps`, 호스트 `localhost:9094` |
| 토픽 없음 | 미생성 | UI/CLI 로 T1 생성, 또는 broker auto-create |
| dry-run 400 casting_id | 형식·FK 없을 예정 | `yymmdd_hhmmss_n` 형식, mes 원본 행 먼저 |
| mes INSERT FK 위반 | investment_casting 에 ID 없음 | 데이터 선도착 규칙 — 원본 행 먼저 |
| mes INSERT 권한 | app_lake 로 씀 | **app_mes** 사용 |
| lake 미반영 | spark_sync 미발행·잡 미기동 | 신호 토픽·Spark 잡 로그 |
| lake 권한 | app_mes 로 lake | **app_spark** |
| Base64 오류 | 잘린 페이로드·인코딩 | E1a 전체 문자열, content_type |
| 원본 URI 404 | 원본 PC 삭제 | **정상** — lake.image_base64 사용 |
| Flink/Spark OOM | 메시지 과대 | 크기 제한·청크는 2차 이후 검토 (현행 E1a) |

## 결과 기록

날짜 / PC / compose 버전 / 통과 항목 / 로그 경로 → `DH/로그_기록.md` 유지 항목에 요약.
