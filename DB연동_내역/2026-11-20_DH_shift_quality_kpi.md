# DB 연동 — Shift 봇 품질 검사 KPI 컨텍스트 (2026-11-20, DH)

| 항목 | 내용 |
|------|------|
| 기능 | Shift 봇 ask 시 품질 검사 대시보드와 동일 KPI(전체 생산 샷·최종 불량률·전체 불량 개수)를 LLM 근거·sources로 포함 |
| 새 테이블 | **없음** |
| 읽기 | `mes.investment_casting`·`mes.casting_image`·`ai.quality_prediction` (`DATABASE_URL` / app_lake), 1차 `casting.model.scores`+threshold, 2차는 저장된 판정만 |
| API | JH `POST /api/documents/ask` 내부 `documents/quality_context.py` |
| 비고 | KST 당일(없으면 라인별 최신일), line_no1~3. pending(2차 대기)은 불량 미포함. ask마다 DL 재추론 없음 |
