# aiax-db — 열처리 공정 최적화 AX 데이터베이스

PostgreSQL 18.6 하나 안에서 스키마로 영역을 나눈 DB입니다. (하둡·HDFS 미사용)

| 스키마 | 영역 | 쓰는 쪽 | 읽는 쪽 |
|---|---|---|---|
| `mes` | 원본 (MES·센서) | Data Producing APP | Spark |
| `lake` | Data Lake (정제) | Spark | Spark |
| `mart` | Data Mart (집계·학습용) | Spark | AI 학습 |
| `meta` | 적재 배치·파이프라인 실행 이력 | 각 주체 | 전체 |

> 데이터셋 미확정 상태용 구조입니다. Excel 행은 `mes.raw_record`(jsonb)에 그대로,
> 센서값은 `mes.sensor_reading`(태그·시각·값 세로형)에 저장해 컬럼이 바뀌어도 테이블 변경이 필요 없습니다.
> 학습 피처 컬럼은 데이터셋 확정 후 `mart`에 추가합니다.

## 버전 (2026-11-05 고정)

팀원 모두 같은 환경이 되도록 정확한 버전을 고정했습니다. 버전을 바꿀 때는 이 표와 `docker-compose.yml`을 함께 수정합니다.

| 구성요소 | 버전 | 이미지 / 고정 위치 | 비고 |
|---|---|---|---|
| PostgreSQL | 18.6 | `postgres:18.6` | 원본·Lake·Mart 단일 DB |
| Apache Kafka | 3.9.2 | `apache/kafka:3.9.2` | KRaft 단독 실행. Kafka UI 버전 인식·호환성 때문에 3.x 마지막 버전 |
| Kafka UI | 1.5.0 | `kafbat/kafka-ui:v1.5.0` | 관리 화면 |
| Apache Spark | 4.2.1 | `apache/spark:4.2.1-python3` | master 1 + worker 1 |
| Apache Flink | 2.2.1 | `flink:2.2.1-java17` → `aiax-flink:2.2.1` | 2.3은 Kafka 커넥터 미지원으로 제외 |
| PyFlink | 2.2.1 (Python 3.12) | `flink/Dockerfile` | PyFlink 지원 범위가 Python 3.9~3.12 |
| Flink Kafka 커넥터 | 5.0.0-2.2 | `flink/Dockerfile` | Flink 2.2용 |
| uv (Flink 이미지 안) | 0.13.7 | `flink/Dockerfile` | |
| PostgreSQL JDBC (Spark용) | 42.7.11 | `spark-submit --packages` | |
| Python (앱) | 3.13 | `apps/.python-version` | 라이브러리 버전은 `apps/uv.lock`으로 고정 |
| Java | 17 | Spark·Flink 이미지에 포함 | |

## 파일 구성

```text
docker-compose.yml     PostgreSQL 18 컨테이너
.env.example           설정 예시 (복사해서 .env 로 사용)
init/                  최초 실행 시 자동 적용 (이름순)
  00_roles.sh          권한 그룹·서비스 계정
  01_schemas.sql       스키마·시간대·기본 보안
  02_meta.sql          이력 테이블, 월 파티션 함수
  03_mes.sql           원본 영역
  04_lake.sql          Data Lake 영역
  05_mart.sql          Data Mart 영역
  06_grants.sql        영역별 권한
tests/verify.sql       구조·권한·흐름 검증 (실행 후 데이터 남지 않음)
```

## 실행 (Windows + Docker Desktop)

```powershell
copy .env.example .env      # 비밀번호를 각자 값으로 수정
docker compose up -d
docker compose ps           # STATUS 가 healthy 인지 확인
```

검증:

```powershell
docker compose exec postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -f /tests/verify.sql'
```

마지막에 `모든 검증 통과` 가 나오면 정상입니다. `FAIL` 이 나오면 그 줄에서 멈춥니다.

**주의:** `init/` 스크립트는 **DB 볼륨이 비어 있을 때 한 번만** 실행됩니다.
스크립트를 고친 뒤 다시 적용하려면 볼륨을 지우고 재생성합니다 (데이터 모두 삭제됨).

```powershell
docker compose down -v
docker compose up -d
```

## 계정과 권한

| 계정 | 용도 | mes | lake | mart | meta |
|---|---|---|---|---|---|
| `aiax_admin` (.env) | 관리·스키마 변경 | 전체 | 전체 | 전체 | 전체 |
| `app_producer` | Data Producing APP | 읽기·쓰기 | - | - | 적재이력 쓰기 |
| `app_spark` | Spark | 읽기 | 읽기·쓰기 | 읽기·쓰기 | 파이프라인이력 쓰기 |
| `app_ml` | AI 학습 | - | - | 읽기 | 읽기 |
| `app_readonly` | 조회·분석 | 읽기 | 읽기 | 읽기 | 읽기 |

원본(`mes`)은 어떤 앱 계정도 삭제할 수 없습니다.

## 접속 방식

### A. 각자 로컬 (기본)
`.env` 의 `POSTGRES_BIND_IP=127.0.0.1` → 내 PC에서만 접속.

### B. 내 PC를 서버로 (같은 Wi-Fi)
1. `.env` 에서 `POSTGRES_BIND_IP=0.0.0.0` 후 `docker compose up -d`
2. Windows 방화벽에서 5432 TCP 인바운드 허용 (가능하면 같은 네트워크 대역만)
3. 내 PC IP 확인: `ipconfig` → IPv4 주소. 공유기에서 IP 고정 권장
4. 팀원은 호스트를 `localhost` 대신 내 IP로 접속

학교·카페 등 공용 Wi-Fi는 기기 간 통신이 막혀 있을 수 있습니다.

### 접속 정보 예시

| 사용처 | 형식 |
|---|---|
| Python (psycopg 등) | `postgresql://app_producer:<비밀번호>@<호스트>:5432/aiax` |
| Spark JDBC | `jdbc:postgresql://<호스트>:5432/aiax` (user=`app_spark`) |
| 같은 compose 네트워크의 다른 컨테이너 | 호스트 = `postgres` |

## 적재 규칙

1. 적재 시작 시 `meta.ingestion_batch` 에 한 행 추가 → `batch_id` 를 원본 데이터에 기록
2. 센서 데이터 적재 **전에** 해당 기간 파티션 생성
   ```sql
   SELECT meta.ensure_monthly_partitions('mes.sensor_reading', '2026-01-01', '2026-12-31');
   ```
   파티션이 없는 기간은 `_default` 파티션에 들어가 유실되지 않지만,
   default 에 데이터가 있는 기간은 나중에 파티션을 만들 수 없으므로 미리 만들어 둡니다.
3. Spark 작업은 `meta.pipeline_run` 에 실행 이력을 남기고 `run_id` 를 결과에 기록
4. lake 적재는 `ON CONFLICT (tag_id, measured_at)` 로 재실행해도 중복이 생기지 않게 합니다.

## 아직 정하지 않은 것

- 실제 데이터셋 컬럼 → `mes` 기준정보 보강, `mart` 학습 피처 테이블
- 실시간 경로(추론 결과·공정제어 판단) 저장 여부
- 백업 주기
