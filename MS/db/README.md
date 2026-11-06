# MS/db — 열처리 공정 최적화 AX 데이터 인프라

담당: **MS** · 최종 갱신: 2026-11-05 · 상태: **구축·검증 완료, 기능 코드 없음**

PostgreSQL · Kafka · Spark · Flink를 Docker Compose 하나로 띄우는 **데이터 파이프라인 인프라**입니다.
이 폴더만 있으면 어느 PC에서나 같은 환경이 만들어집니다. 실제 데이터와 앱 기능은 아직 없습니다.

> **AI 에이전트(Claude·Cursor 등)에게:** 이 README에 구조·사용법·결정 이유·현재 상태·규칙 검토 결과를, [`명명규칙.md`](명명규칙.md)에 테이블·컬럼 이름 규칙을 담았습니다. 팀 공통 규칙은 루트 [`AGENTS.md`](../../AGENTS.md)를 따릅니다.

---

## 1. 무엇을 위한 인프라인가

열처리 공정 최적화 AX 프로젝트의 데이터 흐름(팀 설계)을 그대로 구현할 설비입니다.

```text
Excel 센서 데이터
  → Data Producing APP
      ├─ 과거 데이터: PostgreSQL(mes 원본) → Spark 정제 → lake → Spark 집계 → mart → AI 모델 학습
      └─ 실시간 데이터: Kafka → Flink 전처리 → Inference APP → Kafka → 공정제어 APP
  학습된 모델 → Inference APP에 배포
```

- **Data Lake·Data Mart는 HDFS 없이 PostgreSQL 안의 스키마**로 구성합니다 (팀 결정: 하둡은 과함).
- 이 폴더가 제공하는 것: PostgreSQL·Kafka·Spark·Flink 설비, DB 스키마·계정·권한, Python 앱 프로젝트 틀(`apps/`).
- 이 폴더에 아직 없는 것: Data Producing / Inference / 공정제어 APP 코드, Spark·Flink 작업 코드, 실제 데이터.

## 2. 서비스 구성

| 서비스 (compose 이름) | 역할 | 내 PC에서 접속 | 컨테이너끼리 접속 |
|---|---|---|---|
| `postgres` | 원본·Lake·Mart DB | `localhost:5432` (DB `aiax`) | `postgres:5432` |
| `kafka` | 실시간 데이터 전달 | `localhost:9094` | `kafka:9092` |
| `kafka-ui` | Kafka 관리 화면 | http://localhost:8080 | - |
| `spark-master`, `spark-worker` | 배치 정제·집계 | 화면 http://localhost:8090 | `spark://spark-master:7077` |
| `flink-jobmanager`, `flink-taskmanager` | 실시간 전처리 (PyFlink) | 화면 http://localhost:8081 | `flink-jobmanager:8081` |

전부 띄우면 메모리 약 6~7GB를 사용합니다. 필요한 서비스만 골라 띄울 수 있습니다.

## 3. 버전 (2026-11-05 고정)

팀원 모두 같은 환경이 되도록 정확한 버전으로 고정했습니다. 바꿀 때는 이 표, `docker-compose.yml`, `flink/Dockerfile`을 함께 수정합니다.

| 구성요소 | 버전 | 고정 위치 | 선택 이유 |
|---|---|---|---|
| PostgreSQL | 18.6 | `postgres:18.6` | 최신 안정판 (19는 베타) |
| Apache Kafka | 3.9.2 | `apache/kafka:3.9.2` | Kafka UI가 4.4를 Unknown으로 표시 → 호환성이 가장 넓은 3.x 마지막 버전 |
| Kafka UI | 1.5.0 | `kafbat/kafka-ui:v1.5.0` | |
| Apache Spark | 4.2.1 | `apache/spark:4.2.1-python3` | 최신 안정판 |
| Apache Flink | 2.2.1 | `flink:2.2.1-java17` → `aiax-flink:2.2.1` | 2.3은 Kafka 커넥터 미지원 |
| PyFlink | 2.2.1 (Python 3.12) | `flink/Dockerfile` | PyFlink 지원 범위 3.9~3.12 |
| Flink Kafka 커넥터 | 5.0.0-2.2 | `flink/Dockerfile` | Flink 2.2용 |
| uv (Flink 이미지 안) | 0.13.7 | `flink/Dockerfile` | |
| PostgreSQL JDBC | 42.7.11 | `spark-submit --packages` | Spark ↔ PostgreSQL |
| Python (앱) | 3.13 | `apps/.python-version` | 라이브러리 버전은 `apps/uv.lock`으로 고정 |
| Java | 17 | Spark·Flink 이미지 내장 | |

## 4. 처음 실행하는 팀원 (Windows)

### 준비 (PC당 1회)

1. **Docker Desktop** 설치 (WSL2 백엔드). `docker run hello-world`가 되면 준비 완료.
2. 프로젝트 포트 `5432 7077 8080 8081 8090 9094`가 비어 있어야 합니다 (`netstat -ano | findstr "5432 8080"`). PC에 PostgreSQL이 따로 있으면 `.env`의 `POSTGRES_PORT`를 5433 등으로 바꿉니다.
3. Python 앱을 다룰 사람만: **uv** 설치 (`powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"`).

### 실행

```powershell
cd <저장소>\MS\db
copy .env.example .env                 # 비밀번호는 팀 공용값으로 수정
docker compose up -d --build           # 첫 실행은 이미지 다운로드·Flink 빌드로 10분 이상
docker compose ps                      # 7개 모두 Up / postgres는 healthy
```

### 동작 확인

| 대상 | 명령·화면 | 정상 결과 |
|---|---|---|
| DB (`docker compose ps`에서 `healthy` 확인 후) | `docker compose exec postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -f /tests/verify.sql'` | 마지막 줄 `모든 검증 통과` |
| Kafka | http://localhost:8080 | 클러스터 `aiax` Online, Version `3.9-IV0` |
| Spark | `docker exec aiax-spark-master /opt/spark/bin/spark-submit --master spark://spark-master:7077 /opt/spark/examples/src/main/python/pi.py 10` | `Pi is roughly 3.14…` |
| Flink | `docker exec aiax-flink-jobmanager ./bin/flink run -py /opt/flink/examples/python/datastream/word_count.py` | `Job … has finished.` |
| 앱 | `cd apps` → `uv sync` → `uv run python -c "import pandas, psycopg, confluent_kafka, fastapi, sklearn; print('ok')"` | `ok` |

### 데이터 (자동 포함)

`init/08_data.sql.gz`에 MS PC DB의 mes·lake·mart 데이터가 통째로 들어 있어, **빈 DB가 처음 만들어질 때 자동으로 채워집니다** (첫 `up` 또는 `down -v` 후 `up`). 원본 CSV는 필요 없습니다.

`healthy` 후 확인:

```powershell
"SELECT (SELECT count(*) FROM mes.investment_casting) mes, (SELECT count(*) FROM lake.lake_investment_casting) lake, (SELECT count(*) FROM mart.mart_investment_casting) mart;" | docker compose exec -T postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
```

정상 결과: `73612 | 73612 | 57295`. (PowerShell은 명령 안의 큰따옴표를 지우므로 SQL은 이렇게 파이프로 넘깁니다.) 데이터가 크면 처음 `healthy`까지 수십 초 더 걸립니다.

**덤프 다시 뜨기** (DB 구조나 데이터가 바뀌었을 때, MS):

```powershell
docker compose exec postgres sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --data-only --schema=mes --schema=lake --schema=mart | gzip > /tmp/08_data.sql.gz'
docker compose cp postgres:/tmp/08_data.sql.gz init/08_data.sql.gz
```

`tests/load_csv_trial.sql`·`fill_lake_trial.sql`·`fill_mart_trial.sql`은 CSV에서 처음부터 다시 만들 때만 씁니다 (이때는 `08_data.sql.gz`를 빼고 `down -v` → `up -d` 후 실행).

## 5. 평소 사용 명령 (`MS\db` 폴더에서)

| 할 일 | 명령 | 비고 |
|---|---|---|
| 켜기 | `docker compose up -d` (일부만: 서비스 이름 나열) | `restart: unless-stopped` → Docker Desktop이 켜지면 자동 재시작 |
| 상태 | `docker compose ps` | |
| 로그 | `docker compose logs --tail 50 <서비스>` | |
| 끄기 | `docker compose stop` | 데이터 유지 |
| 컨테이너 재생성 | `docker compose down` → `up -d` | DB 유지, Kafka 토픽은 삭제 |
| **DB 초기화** | `docker compose down -v` → `up -d` | **DB 데이터 전부 삭제.** `init/`을 고쳤을 때만 |
| Flink 이미지 재빌드 | `docker compose build flink-jobmanager` | `flink/Dockerfile` 수정 시 |

## 6. 폴더 구성

```text
MS/db/
  README.md              이 문서 (사용법·설계·결정 기록)
  명명규칙.md            테이블·컬럼 이름 규칙 (팀 공통)
  docker-compose.yml     서비스 7개 정의 (project name: aiax-db)
  .env.example           설정 견본 → .env로 복사 (.env는 git 제외)
  .gitignore             .env, data/raw/, apps/.venv/, *.log 제외
  .gitattributes         *.sh·*.sql·*.yml 줄바꿈 LF 고정 (Windows CRLF로 init 실패 방지)
  init/                  DB 최초 생성 시 1회 실행 (이름순)
    00_roles.sh          권한 그룹(role_*)·서비스 계정(app_*), 비밀번호는 .env에서
    01_schemas.sql       mes/lake/mart 스키마, 시간대 Asia/Seoul, public 쓰기 차단
    03_mes.sql           원본: investment_casting (원본 23개 컬럼 + casting_id)
    04_lake.sql          정제: lake_investment_casting (casting_id 외래키 + 원본 20개 컬럼)
    05_mart.sql          학습: mart_investment_casting (casting_id 외래키 + 18개 컬럼, molten_capacity 결측·정답 빈 행 제외)
    06_grants.sql        영역별 권한 + 이후 테이블 기본 권한
    07_comments.sql      mes 테이블·컬럼 한글 설명(COMMENT)
    08_data.sql.gz       mes·lake·mart 데이터 덤프 (빈 DB 생성 시 자동 적재, 약 4.6MB)
  tests/verify.sql       mes·lake·mart 테이블 대상 52개 항목 검증, 데이터가 있어도 실행 가능, 전체 ROLLBACK
  tests/load_csv_trial.sql  원본 CSV 전체 시험 적재 (구경용, 정식 적재는 Data Producing APP)
  tests/fill_lake_trial.sql mes → lake 값 그대로 복사 (시험용, 정식은 Spark). 여러 번 실행해도 한 벌
  tests/fill_mart_trial.sql lake → mart, molten_capacity 결측 행·정답 빈 행 제외 (시험용, 정식은 Spark)
  spark/jobs/            Spark 작업 코드 자리 (컨테이너 /opt/spark/jobs)
  flink/Dockerfile       팀용 Flink 이미지 (PyFlink + Kafka 커넥터)
  flink/jobs/            Flink 작업 코드 자리 (컨테이너 /opt/flink/jobs)
  apps/                  Python 3.13 uv 프로젝트 (앱 코드 자리, 현재 비어 있음)
  data/raw/              Excel 원본 자리 (git 제외)
```

## 7. DB 설계

### 영역(스키마)

| 스키마 | 내용 | 쓰는 쪽 → 읽는 쪽 |
|---|---|---|
| `mes` | 원본 그대로 (가공 금지) | Data Producing APP → Spark |
| `lake` | 정제 데이터 (mes 값 그대로 복사, EDA 검토 완료) | Spark → Spark |
| `mart` | 학습·분석용 데이터 | Spark → AI 학습 |

### mes 테이블 (주조 데이터 기준, 2026-11-07)

| 테이블 | 한 행 | 내용 |
|---|---|---|
| `mes.investment_casting` | 제품 1개 생산 | 원본 23개 컬럼을 **원본 이름 그대로** 저장 (대문자는 소문자로) + 맨 앞 `casting_id` |

- `casting_id` = 생산일자_생산시각_생산번호 (예: `260804_070411_1`). 원본 값으로 DB가 자동 생성하는 기본키. 원본 날짜 라벨이 실제 날짜와 달라 날짜+시각만으로는 302쌍이 겹쳐 생산번호까지 포함했다.
- 그 외 계산값은 없음. 원본 `timestamp`(일자)·`date`(시각)를 합친 생산 일시와 월 파티션은 lake에서 만든다.
- 컬럼별 한글 이름·원본 이름·단위는 각 컬럼 `COMMENT`에 있음 (DBeaver에서 바로 보임). 대응표는 [`명명규칙.md`](명명규칙.md) 8절.
- 실제 데이터 73,612행 전체 적재 시험 완료 (불량 3,277건, `molten_capacity` 빈 값 16,316건 그대로 보존).
- `lake.lake_investment_casting` (2026-11-07 생성): `casting_id`(기본키이자 `mes.investment_casting` 참조 외래키) + 원본 20개 컬럼(`timestamp`, `date`, `mold_temperature` ~ `passorfail`, mes와 같은 순서·이름·형식). `line_unit`·`production`(값 하나뿐), `production_count`(`casting_id`에 포함)는 제외. 지금은 mes 값을 그대로 복사하며 이상값은 EDA 검토 결과 그대로 둔다.
- `mart.mart_investment_casting` (2026-11-07 생성): `casting_id`(기본키이자 `lake.lake_investment_casting` 참조 외래키) + 학습용 18개 컬럼(`mold_temperature` ~ `passorfail`). `molten_capacity` 결측 행(16,316행, 약 22%)과 정답(`passorfail`) 빈 1행은 모델 학습에 쓰지 않아 넣지 않음 → 57,295행 (불량 2,606건, 4.55%). `passorfail`은 빈 값 금지(NOT NULL).

### 규칙

- 테이블·컬럼 이름은 [`명명규칙.md`](명명규칙.md)를 따른다 (소문자 `snake_case`, 원본 이름 우선, 새 이름은 의미형, 한글 설명 COMMENT).
- 시각은 `timestamptz`, DB 시간대 `Asia/Seoul`.
- mes는 원본 그대로 저장한다 (계산값·파티션 없음). 일자·시각 조회는 `("timestamp", "date")` 인덱스 사용.
- 적재 이력(meta)은 두지 않는다. 필요해지면 다시 검토.

### 계정과 권한

| 계정 | 용도 | mes | lake | mart |
|---|---|---|---|---|
| `aiax_admin` (.env) | 관리·스키마 변경 | 전체 | 전체 | 전체 |
| `app_producer` | Data Producing APP | 읽기·쓰기(삭제 불가) | - | - |
| `app_spark` | Spark | 읽기 | 읽기·쓰기 | 읽기·쓰기 |
| `app_ml` | AI 학습 | - | - | 읽기 |
| `app_readonly` | 조회 | 읽기 | 읽기 | 읽기 |

### 이 DB를 쓰는 기능을 만들 때

기능 담당자는 루트 `DB연동_내역/`에 "이 기능은 어떤 스키마·테이블을 읽고/쓰는지"를 [기록_양식](../../DB연동_내역/기록_양식.md)대로 남깁니다. 계정은 위 표에서 역할에 맞는 것을 사용합니다.

### 적재 절차

1. 원본 23개 컬럼만 넣는다 (`casting_id`는 자동 생성). 같은 행을 다시 넣으면 `casting_id` 중복으로 거부된다.
2. 원본(`mes`)은 수정·삭제하지 않는다. 정제는 lake에서.
3. lake는 mes에, mart는 lake에 있는 `casting_id`만 받는다 (외래키). 순서: mes 적재 → lake 채우기 → mart 채우기.
4. 지금은 `tests/fill_lake_trial.sql`·`fill_mart_trial.sql`로 값 그대로 복사, 정식으로는 Spark 작업이 담당.

## 8. 접속 방식

- **A. 각자 로컬 (기본):** `.env`의 `POSTGRES_BIND_IP=127.0.0.1` → 내 PC에서만 접속.
- **B. 한 PC를 서버로 (같은 네트워크):** `POSTGRES_BIND_IP=0.0.0.0` 후 재시작, Windows 방화벽 5432 허용, 팀원은 서버 PC의 IP로 접속. 공용 Wi-Fi에서는 사용하지 않습니다.

| 사용처 | 접속 형식 |
|---|---|
| Python (psycopg) | `postgresql://app_producer:<비밀번호>@localhost:5432/aiax` |
| Spark JDBC | `jdbc:postgresql://postgres:5432/aiax` (user `app_spark`, `--packages org.postgresql:postgresql:42.7.11 --conf spark.jars.ivy=/tmp/.ivy2`) |
| Kafka (내 PC 앱) | `localhost:9094` |
| Kafka (컨테이너) | `kafka:9092` |

## 9. 앱 개발 시 지킬 것

1. **학습과 추론은 같은 `apps` 프로젝트**에서 `uv.lock`으로 scikit-learn·joblib 버전을 맞춥니다 (버전이 다르면 저장된 모델 로드 실패 가능).
2. **모델 추론은 Flink가 아니라 Inference APP**에서 합니다 (Flink 컨테이너 Python 3.12 ≠ 앱 Python 3.13).
3. 접속 주소·비밀번호는 코드에 쓰지 않고 `.env`에서 읽습니다 (PC: `localhost`, 컨테이너: 서비스 이름).
4. PyFlink(`apache-flink`)는 Windows에 설치하지 않습니다 (Windows용 배포 없음). Flink 작업은 `flink/jobs/`에 두고 컨테이너에서 실행합니다.
5. 라이브러리 추가는 `uv add`만 사용하고, 팀 규칙에 따라 승인 요청 후 추가합니다.

## 데이터셋 (2026-11-06 확보, EDA 전)

| 항목 | 내용 |
|---|---|
| 이름 | 주조 공정최적화 AI 데이터셋 (KAMP, 스마트제조혁신추진단·㈜인터엑스, 2022-12-23 등록) |
| 파일 | `data/raw/Investment_Casting.csv` (8.6MB, **연도를 2026으로 바꾼 파일**), 가이드북 `data/raw/Guidebook_주조 공정최적화 AI 데이터셋.pdf` — 둘 다 git 제외 |
| 공정 | 알루미늄 **다이캐스팅** (파일명은 Investment_Casting), 자동차 실린더 헤드, 설비 PLC 수집 |
| 기간·규모 | 2026-08-04 ~ 2026-10-11 (원본 2021년 → 연도만 2026으로 변경), 73,612행 × 23컬럼, 라인 1개(`line_no1`)·제품 1종(`CylinderHead`) |
| 정답 | `PassOrFail` 0=양품 70,334 / 1=불량 3,277 (불량률 약 4.5%), 빈 값 1행 |
| 주의 | `timestamp`=생산 **일자**, `date`=생산 **시각** (이름이 반대). `timestamp`(날짜)는 실제 달력 날짜가 아니라 **재가동(생산번호 1로 리셋)마다 하루씩 바뀌는 라벨**로 보임: 자정이 지나도 그대로이고, 63번의 날짜 변경이 모두 리셋 순간과 일치. 그래서 날짜+시각만으로는 302쌍이 겹침 (생산번호까지 넣으면 0). 가이드북은 날짜+시각을 합성키로 안내하지만 실제로는 겹침. `molten_capacity` 빈 값 16,316행. `top_temp4`·`bottom_temp4`는 상수 |
| 출처 표기 | 중소벤처기업부, Korea AI Manufacturing Platform(KAMP), 주조 공정최적화 AI 데이터셋, 스마트제조혁신추진단(㈜인터엑스), 2022.12.23., www.kamp-ai.kr |

컬럼 확정·전처리는 EDA 담당자 결과를 따른다. 가이드북에는 다운로드 회원 정보와 워터마크가 들어 있으므로 외부에 공유하지 않는다.

## 10. 아직 정하지 않은 것

- mart 추가 가공(특징값 등) 여부
- 실시간 데이터: 기존 데이터로 새로 생성(약 20% 분량) — 생성 방법, 저장 위치(예: mes 별도 테이블), 시각·정답 부여 방식
- 적재 이력(meta) 재도입 여부
- 실시간 경로 결과(Flink 전처리값·추론 결과·공정제어 판단)의 DB 저장 여부
- Kafka 토픽 이름 규칙 (현재 테스트용 `sensor.raw`만 사용)
- DB 백업 주기, 서버(B 방식) 운영 여부

## 11. 결정 기록

| 날짜 | 결정 | 이유 |
|---|---|---|
| 10-31 | PostgreSQL 한 DB 안에 `mes`/`lake`/`mart`/`meta` 스키마 | 하둡은 과함. 팀 흐름도의 "Data Lake는 PostgreSQL 내 별도 영역" |
| 10-31 | 원본은 jsonb + 세로형 센서 테이블 | 데이터셋 미확정, 컬럼이 바뀌어도 스키마 변경 없음 |
| 10-31 | 서비스별 계정 분리, 원본 삭제 불가, 월 파티션 | 최소 권한·원본 보존·시계열 증가 대비 |
| 11-06 | mes에서 `produced_at`·월 파티션 제거. 일자+시각 병합과 파티션은 lake에서 | 원본 층은 원본 그대로 (MS 결정). 파티션 함수 `meta.ensure_monthly_partitions`도 삭제, lake 설계 시 재검토 |
| 11-07 | `mes.cast_shot`은 원본 23개 컬럼만 (`shot_id`·`batch_id`·`source_row_no`·`ingested_at` 삭제). 행 번호·중복 정리는 lake에서 | 원본 층은 원본 그대로 (MS 결정). 적재 출처는 `raw_record`·`ingestion_batch`에 남음 |
| 11-07 | `raw_record`·`meta` 스키마(`ingestion_batch`)·`mart.training_dataset` 삭제. `cast_shot` → `investment_casting`(원본 파일 이름), 맨 앞에 `casting_id`(생산일자_생산시각_생산번호) 자동 생성 기본키 추가. lake 가칭도 `investment_casting` | MS 결정. 원본 `timestamp`는 재가동마다 바뀌는 날짜 라벨로 보여 날짜+시각만으로는 302쌍이 겹침 → 생산번호 포함 시 73,612행 모두 고유 |
| 11-07 | `lake.investment_casting` 생성: `casting_id` + 19개 컬럼, mes와 같은 순서·이름·형식, 우선 값 그대로 복사 | MS 지정 컬럼. `casting_id`는 mes 원본 연결·중복 방지용 |
| 11-07 | lake 테이블을 `lake.lake_investment_casting`으로 재생성: `casting_id`(외래키 → mes) + `timestamp`·`date` 포함 20개 컬럼, `production_count` 제외 | MS 지정. mes에 없는 행은 lake에 들어갈 수 없음 |
| 11-07 | `mart.mart_investment_casting` 생성: `casting_id`(외래키 → lake) + 18개 컬럼, `molten_capacity` 결측 행 제외 | MS 지정. 결측 행(약 22%)은 모델 학습에 사용하지 않음 |
| 11-07 | mart에서 정답(`passorfail`) 빈 1행도 제외, `passorfail` NOT NULL | 정답 없는 행은 학습 불가 (MS 결정) |
| 11-07 | 데이터는 CSV 대신 DB 덤프(`init/08_data.sql.gz`)로 git에 포함, 빈 DB 생성 시 자동 적재 | MS 결정. 팀원이 CSV·스크립트 없이 같은 DB를 바로 사용. 가이드북 PDF는 계속 git 제외 |
| 11-07 | 데이터 연도 2021 → 2026 변경 (원본 CSV 파일 자체 수정, `timestamp`만). `casting_id`도 `26…`으로 바뀜. 덤프 다시 생성 | MS 결정. 2021·2026 모두 평년이라 날짜 어긋남 없음, 요일은 바뀜(EDA상 요일 무관). CSV는 git 제외 유지 |
| 10-31 | 전부 Docker Compose | Spark Windows 설치 문제, PyFlink Windows 미지원, 팀 환경 통일 |
| 11-03 | 버전은 "문제없는 한 최신" | MS 결정 |
| 11-03 | Flink 2.2.1 (2.3 아님) | Kafka 커넥터 5.0.0이 2.1·2.2만 지원 |
| 11-03 | Kafka 4.4.0 → 3.9.2 | Kafka UI가 4.4를 Unknown으로 표시, 3.9.2가 호환 범위 가장 넓음 |
| 11-03 | Flink 이미지에 uv로 Python 3.12 | PyFlink 지원 범위 3.9~3.12 |
| 11-05 | 이미지 태그 전부 정확한 버전으로 고정 | 팀원이 언제 받아도 동일 환경 |
| 11-05 | 루트 `db/` → `MS/db/` | DH 요청, "개별 기능은 개인 폴더" 규칙 |
| 11-06 | 데이터셋 = KAMP 주조(다이캐스팅) 확정 | 팀 결정 |
| 11-06 | 명명 규칙 제정 (원본 이름 우선 + 의미형 snake_case) | [`명명규칙.md`](명명규칙.md) |
| 11-06 | 열처리 초안 테이블 삭제 (lake: sensor_reading·lot, mart: lot_sensor_summary·lot_quality_label). `mart.training_dataset`만 유지 | 주조 데이터에 쓰지 않음 |
| 11-06 | 원본 컬럼은 **원본 이름 그대로** 사용 (A안). 새로 만드는 값만 규칙 적용, (날짜+시각 병합은 이후 lake로 이동) | 팀원이 CSV·가이드북 이름 그대로 사용. `timestamp`·`date`는 PostgreSQL에서 컬럼 이름으로 사용 가능 확인 |
| 11-06 | mes를 주조 기준으로 재구성: `cast_shot`(표준 이름, 원본 값) + `raw_record`(원본 백업), 열처리용 mes 테이블 삭제 | 주조 데이터는 LOT·센서 태그 구조가 없고 한 행에 모든 값이 있음 |

## 12. 문제 해결 기록

| 증상 | 원인 | 해결 |
|---|---|---|
| Docker 시작 시 `Wsl/…/CreateVm/HCS/ERROR_PATH_NOT_FOUND` | WSL 자체 고장 (Ubuntu 설치도 같은 오류) | `wsl --uninstall` → `wsl --install --no-distribution` → 재부팅 |
| Kafka UI Version이 계속 Unknown | 최초 연결 시 버전을 1시간 캐시 | `docker compose restart kafka-ui` |
| Flink 빌드 `/opt/uv-python: Permission denied` | Flink 2.x 이미지는 `flink` 사용자로 실행 | Dockerfile 설치 단계만 `USER root` |
| `uv init`이 `apps/.git` 생성 | uv 기본 동작 | 삭제 (남으면 팀 저장소에서 별도 저장소로 취급) |
| Flink 예제의 `jdk.compiler`, `bigquery_storage` 경고 | JRE·Apache Beam 안내 | 무시 |

## 13. 검증 기록

| 날짜 | 대상 | 결과 |
|---|---|---|
| 11-03 | DB (PostgreSQL 18) | verify.sql 33개 통과, DBeaver 확인 |
| 11-03 | Kafka 3.9.2 + UI | 토픽 생성, Version `3.9-IV0` |
| 11-03 | Spark 4.2.1 | Workers 1, `pi.py` 완료 |
| 11-04 | Flink 2.2.1 + PyFlink | `word_count.py` 완료 |
| 11-04 | apps (Python 3.13) | import `ok` |
| 11-05 | 버전 고정 후 | 11-06 PostgreSQL 18.6·Kafka UI v1.5.0 이미지 적용 확인. Flink 이미지(uv 0.13.7) 재빌드는 미확인 (`docker compose build flink-jobmanager`) |
| 11-06 | mes 재구성 (PostgreSQL 16, Claude 작업 환경) | verify.sql 36개 통과, 실제 CSV 73,612행 적재 시험 통과 |
| 11-06 | mes 재구성 (MS PC, PostgreSQL 18.6) | `down -v` → `up -d` → verify.sql 36개 통과 |
| 11-06 | 원본 이름(A안)으로 변경 (Claude 작업 환경) | verify.sql 37개 통과, 실제 CSV 73,612행 적재 시험 통과 |
| 11-06 | 원본 이름(A안) (MS PC, PostgreSQL 18.6) | `down -v` → `up -d` → verify.sql 37개 통과 |
| 11-06 | 열처리 초안 삭제 (Claude 작업 환경) | verify.sql 37개 통과 |
| 11-06 | 열처리 초안 삭제 (MS PC, PostgreSQL 18.6) | verify.sql 37개 통과 |
| 11-06 | meta 정리(pipeline_run·column_dict 삭제) (Claude 작업 환경) | verify.sql 35개 통과 |
| 11-06 | mes 원본 그대로(produced_at·파티션 제거) (Claude 작업 환경) | verify.sql 32개 통과 |
| 11-06 | mes 원본 그대로 (MS PC, PostgreSQL 18.6) | `down -v` → `up -d` → verify.sql 32개 통과 |
| 11-07 | mes 원본 23개 컬럼만 (Claude 작업 환경) | verify.sql 32개 통과, 시험 적재(`tests/load_csv_trial.sql`) 73,612행 통과 |
| 11-07 | investment_casting·meta 삭제 (Claude 작업 환경) | verify.sql 30개 통과 (적재 전·후 모두), 시험 적재 73,612행 = casting_id 73,612개, 재적재 시 중복으로 거부 확인 |
| 11-07 | investment_casting·meta 삭제 (MS PC, PostgreSQL 18.6) | `down -v` → `up -d` → verify.sql 30개 통과 → 시험 적재 73,612행 = casting_id 73,612개 |
| 11-07 | lake.investment_casting 추가 (Claude 작업 환경) | verify.sql 38개 통과 (적재 전·후), lake 복사 73,612행 = mes와 값 일치, 재실행 시 중복 없음 |
| 11-07 | lake.lake_investment_casting 재생성 (Claude 작업 환경) | verify.sql 40개 통과 (적재 전·후), lake 복사 73,612행 = mes와 값 일치, 외래키 차단 확인 |
| 11-07 | lake.lake_investment_casting 재생성 (MS PC, PostgreSQL 18.6) | `down -v` → `up -d` → verify.sql 40개 통과 → mes 73,612행 → lake 73,612행, 값 일치 73,612 |
| 11-07 | mart.mart_investment_casting 추가 (Claude 작업 환경) | verify.sql 51개 통과 (적재 전·후), lake 73,612 − 결측 16,316 = mart 57,296행, 재실행 시 중복 없음 |
| 11-07 | mart 정답 빈 행 제외 (Claude 작업 환경) | verify.sql 52개 통과, mart 57,295행 (불량 2,606), 빈 값 있는 컬럼 없음 |
| 11-07 | mes·lake·mart 전체 (MS PC, PostgreSQL 18.6) | `down -v` → `up -d` → verify.sql 52개 통과 → mes 73,612 → lake 73,612 (값 일치) → mart 57,295 (불량 2,606) |
| 11-07 | 덤프 복원 (Claude 작업 환경) | 빈 DB + `08_data.sql.gz` → mes 73,612 / lake 73,612 / mart 57,295 (불량 2,606), casting_id 자동 재생성 일치, verify.sql 52개 통과 |
| 11-07 | 덤프 자동 적재 (MS PC, PostgreSQL 18.6) | `down -v` → `up -d` → healthy 약 20초 → mes 73,612 / lake 73,612 / mart 57,295 |
| 11-07 | 2026년 CSV로 재적재 (Claude 작업 환경) | 73,612행 모두 2026-08-04 ~ 2026-10-11, casting_id `260804_070411_1` ~ `261011_214945_75`, verify.sql 52개 통과 |

## 14. 팀 규칙 검토 (2026-11-05, AGENTS.md 기준)

- **충족:** 상대경로, 소문자 snake_case, 한글 주석(비밀 없음), 예외처리(`ON_ERROR_STOP`·환경변수 검사), `.env` 분리, uv만 사용, 자체 테스트(verify.sql), DB 파일 미커밋, MS 폴더 안에서만 작업, 줄바꿈 LF 고정.
- **팀 확인 필요:**
  1. 루트 `개발과정/기술스택.md`에 3절의 기술 미기록
  2. 10항 "목업 = 개인 폴더 `data/` SQLite"와 달리 Docker PostgreSQL 사용
  3. 개인 폴더 확정 구조에 `db/` 없음, `apps` 이름이 "`app` 폴더명 금지"와 혼동 가능
  4. 루트 `README.md`("정식 DB 없음")·`개발과정/확장가능성.md`("PostgreSQL·FastAPI 안 함")가 현재와 다름
- **규칙 절차와 다르게 진행한 것** (처음에 저장소 밖에서 따로 만들었기 때문):
  - 6항 【구현 전에 확인 부탁드립니다】 양식 없이 대화로 범위 확인
  - 6·8항 [라이브러리 승인 요청] 양식 없이 MS가 버전 결정 (이유는 3절·11절)
  - 처음 저장소에 넣을 때 루트에 둠 → `MS/db`로 이동
- **라이선스:** PostgreSQL(PostgreSQL License), Kafka·Kafka UI·Spark·Flink·커넥터·confluent-kafka(Apache-2.0), JDBC(BSD-2), pandas·scikit-learn·joblib·uvicorn(BSD-3), openpyxl·fastapi·pytest·ruff(MIT), psycopg(LGPL-3.0), uv(MIT/Apache-2.0).
