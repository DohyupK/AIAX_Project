# DB연동_내역

팀 공용 **DB 연동·구조 설명·운영 절차**를 둔다.  
현행 SoT: NCP / 로컬 Docker Postgres · DB **`aiax`** · 스키마 `mes` / `lake` / `mart` / **`org`**.

개인 폴더 SQLite 목업(조직·권한)은 **폐기**. 기능별 연동 변경은 아래 날짜 기록으로 남긴다.

## 인덱스 (현행 문서)

| 문서 | 내용 |
|------|------|
| [조직권한_인수인계.md](조직권한_인수인계.md) | org 규칙·로직·파일 지도 (DH) |
| [조직권한_테이블구조.md](조직권한_테이블구조.md) | org 컬럼·생성규칙·목업 |
| [NCP_Postgres_수동설치.md](NCP_Postgres_수동설치.md) | NCP Docker Postgres 기동 |
| [DB구조.md](../DB구조.md) | 루트 현행 스키마·계정 요약 |
| [기록_양식.md](기록_양식.md) | 날짜별 연동 기록 양식 |

## 날짜별 기록

| 파일 | 비고 |
|------|------|
| [2026-11-20_DH_shift_quality_kpi.md](2026-11-20_DH_shift_quality_kpi.md) | Shift 봇 ask 품질 KPI (`mes`+`ai.quality_prediction` 읽기) |
| [2026-11-20_DH_shift_alert_context.md](2026-11-20_DH_shift_alert_context.md) | Shift 봇 ask 관리도 알림 컨텍스트 |
| [2026-11-20_DH_process_alert_daily_notice.md](2026-11-20_DH_process_alert_daily_notice.md) | 메인 일일 공정알람 AI 공지 캐시 (`org.process_alert_daily_notice`) |
| [2026-11-16_DH_org_permission_postgres.md](2026-11-16_DH_org_permission_postgres.md) | org 서버 반영 |
| [2026-11-15_DH_org_permission_sqlite.md](2026-11-15_DH_org_permission_sqlite.md) | **폐기** (Postgres로 대체) |
| [2026-11-10_DH_ncp_mes_dashboard.md](2026-11-10_DH_ncp_mes_dashboard.md) | mes 대시보드 조회 |
| [2026-11-06_JH_process_optimization.md](2026-11-06_JH_process_optimization.md) | JH |

## 기록 방법

1. 스키마·연동이 바뀌면 `YYYY-MM-DD_이니셜_기능명.md` 추가 ([기록_양식.md](기록_양식.md))
2. 조직·권한 상세는 위 인수인계·테이블구조를 갱신
3. 루트 `DB구조.md` 표도 맞춤

## 규칙 요약

- 비밀·접속: 프로젝트 **루트 `.env`만** (개인 폴더 `.env` 금지)
- DDL/시드 쓰기: `shift` · 조회: `app_lake`
- `*.db` Git 금지 (조직권한 SQLite는 삭제됨)
