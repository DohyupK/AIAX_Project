# 교대 인수인계 리포트 — DB 연동

| 항목 | 내용 |
|------|------|
| 날짜 | 2026-11-20 |
| 담당 | JH (구현 DH, JH 승인) |
| 기능 | `shift_handover` — 교대 구간 관리도 경보 · 전체 불량 개수 |
| 신규 테이블 | 없음 |
| 사용 API | 기존 `GET /api/casting/predictions`, `/limits`, `/second`, `/model` (라인·날짜별) |
| 집계 | 클라이언트: 교대 시간 창 필터 → `buildAlertCards` 중 `alarm` · `summarize().final` |
| 비고 | 공정 최적화·품질 검사와 동일 mes/ai 경로. 저장·캐시 없음 |

자세한 기능: [JH/기능표.md](../JH/기능표.md#교대-인수인계-리포트-shift_handover)
