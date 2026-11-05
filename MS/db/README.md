# MS/db — 열처리 공정 최적화 AX 데이터 인프라

담당: **MS** · 최종 갱신: 2026-11-05 · 상태: **구축·검증 완료, 기능 코드 없음**

PostgreSQL · Kafka · Spark · Flink를 Docker Compose 하나로 띄우는 **데이터 파이프라인 인프라**입니다.
이 폴더만 있으면 어느 PC에서나 같은 환경이 만들어집니다. 실제 데이터와 앱 기능은 아직 없습니다.

> **AI 에이전트(Claude·Cursor 등)에게:** 이 README 하나에 구조·사용법·결정 이유·현재 상태·규칙 검토 결과를 모두 담았습니다. 팀 공통 규칙은 루트 [`AGENTS.md`](../../AGENTS.md)를 따릅니다.

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
| DB | `docker compose exec postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -f /tests/verify.sql'` | 마지막 줄 `모든 검증 통과` |
| Kafka | http://localhost:8080 | 클러스터 `aiax` Online, Version `3.9-IV0` |
| Spark | `docker exec aiax-spark-master /opt/spark/bin/spark-submit --master spark://spark-master:7077 /opt/spark/examples/src/main/python/pi.py 10` | `Pi is roughly 3.14…` |
| Flink | `docker exec aiax-flink-jobmanager ./bin/flink run -py /opt/flink/examples/python/datastream/word_count.py` | `Job … has finished.` |
| 앱 | `cd apps` → `uv sync` → `uv run python -c "import pandas, psycopg, confluent_kafka, fastapi, sklearn; print('ok')"` | `ok` |

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
  README.md              이 문서 (유일한 설명 문서)
  docker-compose.yml     서비스 7개 정의 (project name: aiax-db)
  .env.example           설정 견본 → .env로 복사 (.env는 git 제외)
  .gitignore             .env, data/raw/, apps/.venv/, *.log 제외
  .gitattributes         *.sh·*.sql·*.yml 줄바꿈 LF 고정 (Windows CRLF로 init 실패 방지)
  init/                  DB 최초 생성 시 1회 실행 (이름순)
    00_roles.sh          권한 그룹(role_*)·서비스 계정(app_*), 비밀번호는 .env에서
    01_schemas.sql       mes/lake/mart/meta 스키마, 시간대 Asia/Seoul, public 쓰기 차단
    02_meta.sql          ingestion_batch, pipeline_run, 월 파티션 함수
    03_mes.sql           원본: equipment, sensor_tag, lot, raw_record, sensor_reading
    04_lake.sql          정제: sensor_reading, lot
    05_mart.sql          집계: lot_sensor_summary, lot_quality_label, training_dataset
    06_grants.sql        영역별 권한 + 이후 테이블 기본 권한
  tests/verify.sql       33개 항목 검증, 전체 ROLLBACK
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
| `lake` | (태그, 시각) 중복 제거 + 품질 플래그 | Spark → Spark |
| `mart` | LOT별 요약·품질 정답·학습 데이터셋 버전 | Spark → AI 학습 |
| `meta` | 적재 배치·Spark 실행 이력 | 각 주체 → 전체 |

### 데이터셋 미확정 대응

- Excel 한 행은 `mes.raw_record.payload`(jsonb)에 그대로 저장 → 컬럼이 바뀌어도 스키마 변경 불필요.
- 센서값은 `mes.sensor_reading`에 (tag_id, measured_at, value) 세로형으로 저장 → 센서 개수가 바뀌어도 테이블 그대로.
- 미확정 LOT 속성(강종, 중량 등)은 `lot.attributes`(jsonb)에 우선 저장.
- 학습 피처 테이블은 데이터셋 확정 후 `mart`에 추가.

### 규칙

- 식별자는 모두 소문자 `snake_case` (팀 규칙 4항).
- 시각은 `timestamptz`, DB 시간대 `Asia/Seoul`.
- `sensor_reading`(mes·lake)은 월 단위 RANGE 파티션 + default 파티션.
- 모든 데이터는 `batch_id` 또는 `pipeline_run_id`로 출처 추적.

### 계정과 권한

| 계정 | 용도 | mes | lake | mart | meta |
|---|---|---|---|---|---|
| `aiax_admin` (.env) | 관리·스키마 변경 | 전체 | 전체 | 전체 | 전체 |
| `app_producer` | Data Producing APP | 읽기·쓰기(삭제 불가) | - | - | 적재이력 쓰기 |
| `app_spark` | Spark | 읽기 | 읽기·쓰기 | 읽기·쓰기 | 파이프라인이력 쓰기 |
| `app_ml` | AI 학습 | - | - | 읽기 | 읽기 |
| `app_readonly` | 조회 | 읽기 | 읽기 | 읽기 | 읽기 |

### 이 DB를 쓰는 기능을 만들 때

기능 담당자는 루트 `DB연동_내역/`에 "이 기능은 어떤 스키마·테이블을 읽고/쓰는지"를 [기록_양식](../../DB연동_내역/기록_양식.md)대로 남깁니다. 계정은 위 표에서 역할에 맞는 것을 사용합니다.

### 적재 절차

1. 적재 시작 시 `meta.ingestion_batch`에 행 추가 → `batch_id`를 원본 데이터에 기록.
2. 센서 데이터 적재 **전** 해당 기간 파티션 생성: `SELECT meta.ensure_monthly_partitions('mes.sensor_reading', '2026-01-01', '2026-12-31');`
   (default 파티션에 이미 데이터가 있는 기간은 나중에 파티션을 만들 수 없음)
3. Spark 작업은 `meta.pipeline_run`에 실행 이력을 남기고 `run_id`를 결과에 기록.
4. lake 적재는 `ON CONFLICT (tag_id, measured_at)`로 재실행 안전하게.

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

## 10. 아직 정하지 않은 것

- 실제 데이터셋(Excel 컬럼) → `mes` 기준정보 보강, `mart` 학습 피처 테이블
- 실시간 경로 결과(Flink 전처리값·추론 결과·공정제어 판단)의 DB 저장 여부
- Kafka 토픽 이름 규칙 (현재 테스트용 `sensor.raw`만 사용)
- DB 백업 주기, 서버(B 방식) 운영 여부

## 11. 결정 기록

| 날짜 | 결정 | 이유 |
|---|---|---|
| 10-31 | PostgreSQL 한 DB 안에 `mes`/`lake`/`mart`/`meta` 스키마 | 하둡은 과함. 팀 흐름도의 "Data Lake는 PostgreSQL 내 별도 영역" |
| 10-31 | 원본은 jsonb + 세로형 센서 테이블 | 데이터셋 미확정, 컬럼이 바뀌어도 스키마 변경 없음 |
| 10-31 | 서비스별 계정 분리, 원본 삭제 불가, 월 파티션 | 최소 권한·원본 보존·시계열 증가 대비 |
| 10-31 | 전부 Docker Compose | Spark Windows 설치 문제, PyFlink Windows 미지원, 팀 환경 통일 |
| 11-03 | 버전은 "문제없는 한 최신" | MS 결정 |
| 11-03 | Flink 2.2.1 (2.3 아님) | Kafka 커넥터 5.0.0이 2.1·2.2만 지원 |
| 11-03 | Kafka 4.4.0 → 3.9.2 | Kafka UI가 4.4를 Unknown으로 표시, 3.9.2가 호환 범위 가장 넓음 |
| 11-03 | Flink 이미지에 uv로 Python 3.12 | PyFlink 지원 범위 3.9~3.12 |
| 11-05 | 이미지 태그 전부 정확한 버전으로 고정 | 팀원이 언제 받아도 동일 환경 |
| 11-05 | 루트 `db/` → `MS/db/` | DH 요청, "개별 기능은 개인 폴더" 규칙 |

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
| 11-05 | 버전 고정 후 | **재실행 확인 필요** (`docker compose up -d --build` 후 4절 확인) |

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
