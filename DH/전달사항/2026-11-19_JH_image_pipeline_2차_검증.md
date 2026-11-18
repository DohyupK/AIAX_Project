# 전달사항 — 이미지 파이프라인 2차 동작 검증 (DH → JH)

- 작성: DH, 2026-11-19
- 대상: JH
- 목적: 모드 A 파이프(E1a → Kafka → mes → spark_sync → lake)가 사는지 **단계적으로** 확인
- 관련(화면 SoT): [`2026-11-19_JH_image_pipeline_API연결.md`](2026-11-19_JH_image_pipeline_API연결.md)
- MS 산출물 요청(참고만, 본 검증 범위 밖): [`2026-11-19_MS_casting_image_init반영.md`](2026-11-19_MS_casting_image_init반영.md)

쓰기·Kafka는 DH. JH는 아래를 **순서대로** 수행하고, 단계마다 통과/실패를 DH에 회신해 주세요.

---

## 승인 사항 (권한)

**승인:** 본 검증은 DH 담당 코드와 **MS 영역 DB 계정 권한**까지 사용해 파이프 동작을 확인하는 것이 허용된다.

| 계정 | 용도 |
|------|------|
| `app_mes` | `mes.casting_image` 쓰기(검증 경로) |
| `app_spark` | `lake.lake_casting_image` 쓰기(검증 경로) |
| `app_lake` | lake 읽기 — JH 최종 증거 |

JH는 화면 구현 전이어도 `app_lake` SELECT 로 SoT를 확인할 수 있다.

---

## 범위

### 포함 (이번 검증)

- DH Python 파이프: `producer` / `flink_role_a` / `lake_sync_consumer` / `status_server`
- 로컬 Docker: `kafka` + `kafka-ui` (`postgres` 로컬 기동 금지)
- **서버** Postgres + 위 계정 권한
- 단계 통과 후 미사용 API·로그 정리(S6)

### 제외 (MS가 만들어야 하는 것 — 여기서 하지 않음)

- `MS/db/init/` 편입
- 서버 DDL 적용 절차(MS 관례)
- `MS/db/spark/jobs/` 실제 Spark 잡

테이블(`mes.casting_image` / `lake.lake_casting_image`)이 서버에 **아직 없으면** 본 체크리스트를 진행하지 말고 MS 쪽으로 넘긴다. MS 구현을 이 문서 안에서 대신하지 않는다.

---

## 단계 게이트 (필수)

1. **S0 → S6 순서 고정.** 앞 단계를 건너뛰지 않는다.
2. **해당 단계 체크 항목을 전부 통과한 뒤에만** 다음 단계로 간다.
3. 한 항목이라도 실패하면 **그 단계에서 중단**하고 DH에 회신한다.

---

## S0. 사전

- [ ] 루트 `.env`: **서버** Postgres (`DATABASE_URL` 호스트가 서버 — `127.0.0.1` 이면 서버 DB가 아님)
- [ ] `APP_MES_PASSWORD` / `APP_SPARK_PASSWORD` / (`app_lake` 용) `DATABASE_URL` 설정됨
- [ ] 로컬 Docker: `kafka` + `kafka-ui` 만

```bash
cd MS/db
docker compose --env-file ../../.env up -d kafka kafka-ui
```

- [ ] 서버에 테이블 **이미** 존재: `mes.casting_image`, `lake.lake_casting_image`  
  (없으면 중단 → MS. DDL 참고만: [`DH/data/sql/03_casting_image.pg.sql`](../data/sql/03_casting_image.pg.sql))
- [ ] 테스트 `casting_id` ∈ `mes.investment_casting` (FK)
- [ ] `cd DH/api && uv sync`

**→ S0 전부 통과 후에만 S1.**

---

## S1. 상태 API

```bash
cd DH/api
uv run python -m image_pipeline.status_server
```

- [ ] `GET http://127.0.0.1:8765/health` → `ok: true`, `phase: 2`, `mes_configured` / `spark_configured` true
- [ ] `GET /config` → `phase: 2`, `sink_mode: A`, 토픽 T1 3개
- [ ] `POST /v1/image/ingest/dry-run`  
  body 예: `{"casting_id":"<존재하는_id>","image_base64":"AQID","content_type":"image/jpeg"}`  
  → `ok: true`. **DB/Kafka 쓰기 없음**

**→ S1 전부 통과 후에만 S2.**

---

## S2. Kafka (로컬)

- [ ] Kafka UI `http://localhost:8080`
- [ ] bootstrap `localhost:9094`
- [ ] 필수 토픽(E2E 후 재확인 가능): `aiax.image.ingest`, `aiax.image.spark_sync`  
  (`aiax.image.mes_write` 는 모드 B용 — **이번 실경로 미사용**, 없어도 S2 실패로 치지 않음)

**→ S2 전부 통과 후에만 S3.**

---

## S3. 프로세스 기동

```bash
cd DH/api
uv run python -m image_pipeline.flink_role_a
uv run python -m image_pipeline.lake_sync_consumer
# status_server 는 S1용 — 필요 시 유지
```

- [ ] `flink_role_a` 기동·ingest 구독 로그
- [ ] `lake_sync_consumer` 기동·spark_sync 구독 로그

**→ S3 전부 통과 후에만 S4.**

---

## S4. 유입 → mes → lake

```bash
curl -X POST http://127.0.0.1:8765/v1/image/ingest ^
  -H "Content-Type: application/json" ^
  -d "{\"casting_id\":\"<존재하는_id>\",\"image_base64\":\"AQID\",\"content_type\":\"image/jpeg\",\"original_uri\":\"http://example/x.jpg\"}"

# 또는
uv run python -m image_pipeline.producer --casting-id <존재하는_id> --base64 AQID
```

- [ ] `aiax.image.ingest` 에 E1a 도착
- [ ] **서버** `mes.casting_image` 동일 `casting_id` (`app_mes`)
- [ ] `aiax.image.spark_sync` 에 `{"casting_id":"...","op":"upsert"}`
- [ ] **서버** `lake.lake_casting_image` 동일 `casting_id` (`app_spark` 경로)
- [ ] lake `image_base64` 일치, `lake_synced_at` 갱신
- [ ] `original_uri` 로 HTTP GET 하지 않음 (URI 404여도 정상)

**→ S4 전부 통과 후에만 S5.**

---

## S5. JH 조회 SoT (최종 증거)

- [ ] `app_lake` 로 `lake.lake_casting_image` SELECT (화면 전이면 SQL로)
- [ ] 이미지: **`image_base64` 만**
- [ ] **금지:** `original_uri` 로 로드
- [ ] (권장) 동일 `casting_id` 재 ingest → upsert·`lake_synced_at`/`updated_at` 갱신

**→ S0~S5 전부 통과 후에만 S6. 여기까지가 「파이프 생존」판정.**

---

## S6. 구현 성공 후 정리 (미사용 API·로그 제거)

S0~S5를 **모두 통과한 뒤에만** 진행한다. DH `api/image_pipeline` 및 관련 문서 기준.

- [ ] 호출되지 않는 API/엔드포인트, 죽은 핸들러, 미사용 import·변수 제거
- [ ] 실경로와 중복·불필요한 dry-run/미리보기만 남은 자리 정리(필요 시 dry-run 유지 여부는 DH 판단 후 반영)
- [ ] [`DH/로그_기록.md`](../로그_기록.md) 기준으로 **지울 로그** 제거·레벨 하향 (예: `image_base64` 전문). **유지 로그**는 남김
- [ ] 정리 후 회귀: `GET /health`, `GET /config`, ingest 1건 스모크
- [ ] 회신에 **제거한 API·로그 목록** 기입

---

## 실패 시 구분

| 증상 | 가능한 원인 | 대응 |
|------|-------------|------|
| 테이블 없음 | MS init/DDL 미반영 | **검증 중단** → MS 전달 문서 |
| Kafka 연결 거부 | compose·포트 | `docker compose ps`, `localhost:9094` |
| dry-run만 되고 mes/lake 비어 있음 | S3 미기동·ingest 미발행 | consumer / publish 확인 — **S4로 가지 말 것** |
| mes FK 위반 | `investment_casting` 에 id 없음 | 원본 행 먼저 |
| mes 권한 오류 | 잘못된 계정 | **`app_mes`** |
| lake 미반영 | spark_sync·lake consumer | 토픽·로그 — S3/S4 |
| lake 권한 오류 | 잘못된 계정 | **`app_spark`** |
| DB 인증/타임아웃 | `.env` 호스트 `127.0.0.1` 등 | **서버** `DATABASE_URL` |
| Base64/casting_id 400 | 형식·잘린 페이로드 | E1a 전체, `yymmdd_hhmmss_n` |

---

## DH 회신 양식

| 항목 | 내용 |
|------|------|
| 검증 시각 | |
| 사용 `casting_id` | |
| 마지막 통과 단계 (S0~S6) | |
| 실패 단계·증상 | |
| Kafka UI / consumer 로그 요약 | |
| S6 제거한 API·로그 목록 (해당 시) | |

## DH 참조

- 코드: `DH/api/image_pipeline/`
- 지침: [`DH/지침_image_pipeline_임시.md`](../지침_image_pipeline_임시.md)
- Spark 계약(참고): [`DH/api/image_pipeline/spark_rules.md`](../api/image_pipeline/spark_rules.md)
