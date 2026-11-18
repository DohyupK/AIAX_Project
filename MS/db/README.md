# MS/db — 기동 stub

DB 구조·계정·조직권한·NCP 서술 문서는 **여기 두지 않음** (DH 최신 → 루트 문서).

| 문서 | 위치 |
|------|------|
| 스키마·계정 | [`DB구조.md`](../../DB구조.md) |
| 연동·조직권한·NCP | [`DB연동_내역/`](../../DB연동_내역/) |
| 인수인계 | [`DB연동_내역/조직권한_인수인계.md`](../../DB연동_내역/조직권한_인수인계.md) |

이 폴더는 **Docker Compose / init SQL 실행 코드**만 담당.

## 기동 (Windows)

```powershell
cd <저장소>\MS\db
docker compose --env-file ../../.env up -d --build
docker compose --env-file ../../.env ps
```

또는 `start.bat` / Linux `./start.sh`  
메뉴: **1** Postgres만 · **2** 처리만 · **3** 전부

- 비밀: 프로젝트 **루트** `.env`만 (`MS/db/.env` 없음)
- NCP: `POSTGRES_BIND_IP=0.0.0.0`, 보통 Postgres만. 절차 → [`NCP_Postgres_수동설치.md`](../../DB연동_내역/NCP_Postgres_수동설치.md)

## init

`init/` — mes/lake/mart + `09`/`10` org. 스키마 변경 시 `DB구조.md`·`DB연동_내역` 같이 갱신.

## lake 자동 갱신 (mes·org → lake)

매일 00:00 KST 에 원본(mes, org)의 변경분을 lake 에 반영. 설계: [`JH/전달사항/2026-11-16_MS_mes변경시_lake자동갱신_요청.md`](../../JH/전달사항/2026-11-16_MS_mes변경시_lake자동갱신_요청.md)

| 구성 | 파일 | 하는 일 |
|------|------|---------|
| 변경 기록 | `init/09`(org), `init/12`(mes) | 트리거가 원본의 추가·수정·삭제를 `change_log` 에 기록 |
| 처리 위치 | `lake.etl_watermark` (`init/12`) | 작업별로 어디까지 반영했는지 (`mes_to_lake`, `org_to_lake`) |
| Spark 작업 | [`spark/jobs/lake_sync.py`](spark/jobs/lake_sync.py) | 처리 위치 이후 변경만 읽어 lake 에 upsert·delete, 처리 위치 갱신 (한 트랜잭션, 실패 시 그대로) |
| 실행기 | [`apps/src/apps/lake_runner.py`](apps/src/apps/lake_runner.py) | 매일 00:00 KST 에 Spark 작업 실행, 놓친 날은 시작 시 따라잡기, 동시에 1개만 |

org 복제 대상: org 테이블 중 `employee_info`(개인정보)·`hr_access_log`·`change_log` 제외 26개 → `lake.lake_<테이블>`, 키 = `<테이블>_idx`.

### 실행

```bash
cd MS/db/apps
uv run python -m apps.lake_runner --now   # 지금 한 번 (첫 동기화·복구)
uv run python -m apps.lake_runner         # 상주: 매일 00:00 KST
```

### 설정 (루트 `.env`, 비밀번호는 여기 적지 않음)

| 키 | 뜻 | 기본값 |
|----|----|--------|
| `LAKE_SYNC_DATABASE_URL` | 실행기가 처리 위치를 확인할 DB (계정 `app_spark`) | 없음 (필수) |
| `LAKE_SYNC_JDBC_URL` | Spark 가 접속할 DB | `jdbc:postgresql://postgres:5432/aiax` |
| `LAKE_SYNC_USER` / `LAKE_SYNC_PASSWORD` | Spark 접속 계정 | `app_spark` / `APP_SPARK_PASSWORD` |
| `SPARK_SUBMIT` | spark-submit 명령 | `docker exec … aiax-spark-master /opt/spark/bin/spark-submit` |
| `SPARK_MASTER` | Spark 주소 | `spark://spark-master:7077` |
| `LAKE_SYNC_JOB` | 작업 파일 경로 (Spark 쪽) | `/opt/spark/jobs/lake_sync.py` |
| `SPARK_PACKAGES` | JDBC 드라이버 | `org.postgresql:postgresql:42.7.4` |

### 서버 적용 (서버 관리자)

1. 서버에 Spark 설치 (또는 이 compose 의 spark-master/worker 기동)
2. 서버 `.env` 에 위 설정 값 (서버 기준 주소)
3. 실행기를 서비스로 등록해 상주 (myapp 처럼)
4. 첫 실행은 `--now` 로 확인 — `lake.etl_watermark` 의 `last_run_at` 이 갱신되면 정상
