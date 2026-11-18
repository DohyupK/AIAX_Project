# 이미지 파이프라인 임시 지침 (성공·인수 후 이 파일 삭제)

담당: DH. 화면 연결: JH(이후). 테이블 init 반영: MS 전달 참고.

## 확정 요약

| 항목 | 값 |
|------|-----|
| 토픽 T1 | `aiax.image.ingest` / `aiax.image.mes_write` / `aiax.image.spark_sync` |
| 페이로드 | E1a — JSON 메타 + Base64 (`image_base64`) |
| 기본 싱크 | **A** (Flink→mes 직접 INSERT). B 도 설정으로 전환 가능 |
| Flink 역할 (2026-11-19) | Python `flink_role_a` → **Flink job `MS/db/flink/jobs/image_ingest.py`** 로 이전·삭제. 서버 실행: `JH/전달사항/2026-11-19_DH_이미지수집_Flink_서버실행.md` |
| 테이블 | `mes.casting_image` → Spark 최신건 → `lake.lake_casting_image` |
| `original_uri` | **기록만, 로드 금지** |
| 1차 | 뼈대·문서·상태 API (지시받아 구현됨) |
| 2차 | **아직 지시 없음** — 참고만 [`2차_참고목록.md`](2차_참고목록.md) |

## 모드 A / B (사람이 고름)

```text
AIAX_IMAGE_SINK_MODE=A   # 기본 — Flink(역할)가 mes INSERT 후 spark_sync
AIAX_IMAGE_SINK_MODE=B   # Flink → mes_write 토픽 → writer 가 mes INSERT → spark_sync
```

## 1차에서 할 일 (이 PC) — 지금 테스트

1. SQL 적용(선택, shift): [`data/sql/03_casting_image.pg.sql`](data/sql/03_casting_image.pg.sql)  
2. 상태 API:
   ```bash
   cd DH
   python -m api.image_pipeline.status_server
   ```
   - `GET http://127.0.0.1:8765/health`
   - `GET http://127.0.0.1:8765/config`
   - `POST http://127.0.0.1:8765/v1/image/ingest/dry-run`  
     body 예: `{"casting_id":"260804_070411_1","image_base64":"AQID","content_type":"image/jpeg"}`
3. 코드·규칙: `api/image_pipeline/` (1차 뼈대만)

## 2차

지시(「2차 구현 시작」) **받기 전에는** producer/Kafka/Flink/실 DB 쓰기 코드를 만들지 않는다.  
할 일·읽을 문서만: [`2차_참고목록.md`](2차_참고목록.md)

## 참조 API (타 팀)

Kafka/Flink 붙일 때 **DH `api/image_pipeline`** 의 `config`·`payload`·`pipeline`·이 지침을 기준으로 한다.

## 삭제 조건

타 PC E2E 성공 + JH/MS 인수 확인 후 **이 임시 지침 파일 삭제**.
