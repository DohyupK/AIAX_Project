# MS

## 목적

- 담당: **MS**
- 팀원 MS 담당 기능. 루트 수정이 필요하면 DH에게 문의합니다.

## 구조

- `main/` — 이 폴더 기능 오케스트레이션 (루트는 여기만 호출)
- `frontend/pages/<기능>/` — 페이지 (`app` 명칭 사용 금지)
- `api/<기능>/` — API (`backend` 명칭 사용 금지)
- `data/` — SQLite 목업
- `업무일지/` · `기능표.md` · `전달사항/` · `로그_기록.md`
- `db/` — DB·Kafka·Spark·Flink 인프라 (Docker Compose). 실행 방법은 [`db/README.md`](db/README.md)

상세 규칙은 루트 [AGENTS.md](../AGENTS.md) 를 따릅니다.

## 기능 목록

| 기능 | 경로 | 상태 |
|------|------|------|
| DB·데이터 파이프라인 인프라 (PostgreSQL 18.6, Kafka 3.9.2, Spark 4.2.1, Flink 2.2.1) | [`db/`](db/README.md) | 구축·검증 완료 |

## 다른 폴더

- 타 폴더: **읽기만**, 수정 금지. 이상 시 `전달사항/`에 남깁니다.