# 공정 알람 일일 공지 캐시 (DH·JH, 2026-11-20)

| 항목 | 내용 |
|------|------|
| 화면 | `/` 메인 대시보드 「회사 전체 공지」 |
| 테이블 | `org.process_alert_daily_notice` (PK `notice_date` = 표시일 KST) |
| 원본 읽기 | `mes.investment_casting` (전날·라인 1~3 샷) + 관리선 `casting/spc.py` 고정 표 |
| 계정 | `app_lake` (`DATABASE_URL`) — mes 읽기 + **이 테이블만** SELECT/INSERT/UPDATE |
| API | JH `GET /api/main/daily-notice` (`JH/api/notice/router.py`) |
| 동작 | 캐시 히트 → 행 반환. miss → 전날 알람 판정 → LLM 요약 → INSERT ON CONFLICT DO NOTHING |
| DDL | [`DH/data/sql/06_process_alert_daily_notice.pg.sql`](../DH/data/sql/06_process_alert_daily_notice.pg.sql) → MS init 편입 요청 [`DH/전달사항/2026-11-20_MS_공정알람_일일공지_테이블.md`](../DH/전달사항/2026-11-20_MS_공정알람_일일공지_테이블.md) |
| LLM | 기존 `documents/llm_client` (NIM 우선 / OpenAI). 새 패키지·키 없음 |
| 비고 | 테이블 미적용 시 API 503 → 화면은 하드코딩 공지만 표시 |
