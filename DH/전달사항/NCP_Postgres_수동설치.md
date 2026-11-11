# NCP PostgreSQL 수동 설치 (DH)

| 항목 | 내용 |
|------|------|
| 작성일 | 2026-11-10 |
| 담당 | DH |
| 서버 | NCP `49.50.143.236` (Ubuntu 24.04) |
| 목적 | **Postgres만** 기동 후 DH 대시보드 원격 접속 |
| 에이전트 | SSH 대행 없음 — **본인이 SSH로 실행** |

비밀번호·`.pem`은 이 문서에 적지 않는다.  
**Postgres Docker 비밀은 프로젝트 루트 `.env`만** 쓴다 (`MS/db/.env` 없음). 서버의 루트 `.env` 값(비밀번호)을 로컬 루트와 맞추고, NCP에서는 `POSTGRES_BIND_IP=0.0.0.0`으로 둔다.

| 계정 | 용도 |
|------|------|
| `shift` | 관리자 (`POSTGRES_USER`) |
| `app_mes` | mes 적재 |
| `app_spark` | Spark |
| `app_mart` | mart 학습 읽기 |
| `app_lake` | 조회 (DH `DATABASE_URL`) |

**올리지 말 것:** Kafka / Spark / Flink (계획: 로컬 처리).

---

## 0. 사전 확인

1. NCP ACG: TCP **22**, **5432** → **본인 공인 IP만** (`0.0.0.0/0` 금지).  
   IP가 바뀌었으면 ACG를 갱신한다.
2. 인증키 `.pem` 보관 위치 확인 (Git 금지).
3. 로컬 [`MS/db/init/`](../../MS/db/init/) 확인 (읽기·복사).

---

## 1. SSH 접속

```bash
ssh -i <인증키.pem경로> root@49.50.143.236
```

계정명이 `ubuntu`이면 `ubuntu@49.50.143.236`.

---

## 2. Docker 설치 (Ubuntu 24.04)

```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
sudo systemctl enable --now docker
sudo docker run --rm hello-world
```

---

## 3. init·환경 파일 준비

로컬 PC에서 init 복사:

```powershell
scp -i <인증키.pem경로> -r <로컬\AIAX_Project\MS\db\init> root@49.50.143.236:/opt/aiax/init
```

서버:

```bash
sudo mkdir -p /opt/aiax
sudo nano /opt/aiax/.env
```

`/opt/aiax/.env` 형식 (**값은 루트 `.env`와 동일**):

```text
POSTGRES_USER=shift
POSTGRES_PASSWORD=<루트.env와동일>
POSTGRES_DB=aiax
APP_MES_PASSWORD=<루트.env와동일>
APP_SPARK_PASSWORD=<루트.env와동일>
APP_MART_PASSWORD=<루트.env와동일>
APP_LAKE_PASSWORD=<루트.env와동일>
```

```bash
sudo chmod 600 /opt/aiax/.env
```

---

## 4. Postgres 18.6만 기동

```bash
sudo docker pull postgres:18.6

sudo docker run -d \
  --name aiax-postgres \
  --restart unless-stopped \
  -e TZ=Asia/Seoul \
  -e PGTZ=Asia/Seoul \
  --env-file /opt/aiax/.env \
  -p 5432:5432 \
  -v aiax-pgdata:/var/lib/postgresql \
  -v /opt/aiax/init:/docker-entrypoint-initdb.d:ro \
  postgres:18.6
```

```bash
sudo docker logs -f aiax-postgres
```

---

## 5. 검증 (서버)

```bash
sudo docker exec -it aiax-postgres pg_isready -U shift -d aiax

sudo docker exec -it aiax-postgres \
  psql -U shift -d aiax -c "SELECT count(*) FROM mes.investment_casting;"
```

원격 확인 (ACG에 본인 IP 필요):

```bash
# 비밀번호는 루트 .env 의 APP_LAKE_PASSWORD
psql "postgresql://app_lake@49.50.143.236:5432/aiax" -c "SELECT 1;"
```

DH: [`DH/api/mes_dashboard/.env`](../api/mes_dashboard/.env) 의 `DATABASE_URL`이 `app_lake@49.50.143.236` 인지 확인 후 `/health`·대시보드.

---

## 6. 이미 예전에 init된 볼륨이 있을 때

파일만 바꿔도 **DB 안 롤 이름은 예전일 수 있다.**  
새 계정명이 필요하면 첫 기동이거나, 수동 `ALTER ROLE ... RENAME` / 비밀번호 `ALTER ROLE ... PASSWORD` (볼륨 삭제는 데이터 삭제 — 원하지 않으면 하지 말 것).

---

## 7. 실패 시 점검

| 증상 | 볼 곳 |
|------|--------|
| SSH 불가 | ACG 22, pem |
| 5432 타임아웃 | ACG 5432, `-p 5432:5432` |
| 비밀번호 오류 | 서버 루트 `.env` ↔ 로컬 루트 `.env` ↔ DH `DATABASE_URL` |
| 계정 없음 | init 반영 여부, 볼륨 재사용 |

---

## 변경 이력

| 날짜 | 내용 |
|------|------|
| 2026-11-10 | NCP 수동 설치 절차 신설 |
| 2026-11-10 | 관리자 `shift`, 계정 `app_mes`/`app_spark`/`app_mart`/`app_lake` 반영 |
