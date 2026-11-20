# DB 연동 — Shift 봇 관리도 알림 컨텍스트 (2026-11-20, DH)

| 항목 | 내용 |
|------|------|
| 기능 | Shift 봇 ask 시 공정 관리도 알림을 LLM 근거·sources로 포함 |
| 새 테이블 | **없음** |
| 읽기 | `mes.investment_casting` (`DATABASE_URL` / app_lake), `casting.spc.limits`, `casting.alerts_daily.build_alert_cards` |
| API | JH `POST /api/documents/ask` 내부 `documents/alert_context.py` |
| 비고 | KST 당일(없으면 라인별 최신일), 3라인, 상위 30건. 문서 임베딩(DOCS)과 별도 |
