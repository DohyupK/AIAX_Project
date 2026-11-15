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
