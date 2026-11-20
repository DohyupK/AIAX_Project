# 실시간 샷 생성 시연 배속 (DH, 2026-11-20)

| 항목 | 내용 |
|------|------|
| 날짜 | 2026-11-20 |
| 담당 폴더 | DH (JH·MS 승인) |
| 기능명 | 공정최적화 live ×20 ↔ MS shot_generator 배속 |
| 기능표 링크 | [JH 공정 최적화](../JH/기능표.md#공정-최적화-대시보드-process_optimization) · [MS 실시간 샷 생성기](../MS/기능표.md#실시간-샷-생성기-2026-11-20) |
| DB 종류 | PostgreSQL (NCP `aiax`) |
| DB 상대경로 | `MS/db/init/28_shot_generator_control.sql` |
| 목적 | (철회) 시연 배속 표·API — **사용 안 함**. 가속은 생성기 `--speed 20` 만 |

## 테이블·연동

| 테이블명 | 주요 컬럼 | 읽기/쓰기 | 연동 화면·API | 비고 |
|----------|-----------|-----------|---------------|------|
| `mes.shot_generator_control` | `id=1`, `speed`(1\|20), `updated_at` | app_lake SELECT+UPDATE / app_mes SELECT | `GET\|PUT /api/casting/demo-speed`, MS `shot_generator` 폴링 | init 28 |
| `mes.investment_casting` | 기존 | app_mes INSERT (생성기) / app_lake SELECT (JH) | 공정최적화 live | 배속>1 이면 INSERT 시각=벽시계 |

## 메모

- 스키마 변경 이유: JH(app_lake)와 MS 생성기 사이 HTTP 없이 배속 공유.
- **2026-11-21 철회:** JH `demo-speed`·control 표 연동 제거. init 28은 적용하지 않아도 됨. 시연은 `shot_generator --speed 20`.
- 배속 20 시 생성기가 `facility`/`production` cycletime·간격을 ÷20 저장.
