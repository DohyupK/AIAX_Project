# JH

## 목적

- 담당: **JH**
- 팀원 JH 담당 기능. 루트 수정이 필요하면 DH에게 문의합니다.

## 구조

- `main/` — 이 폴더 기능 오케스트레이션 (루트는 여기만 호출)
- `frontend/pages/<기능>/` — 페이지 (`app` 명칭 사용 금지)
- `api/<기능>/` — API (`backend` 명칭 사용 금지)
- `data/` — SQLite 목업
- `업무일지/` · `기능표.md` · `전달사항/` · `로그_기록.md`

상세 규칙은 루트 [AGENTS.md](../AGENTS.md) 를 따릅니다.

## 기능 목록

| 기능 | 경로 | 상태 |
|------|------|------|
| 공정 안전 플랫폼 인덱스 | `frontend/pages/platform_index/` | 루트 layout 연결 |
| 공정 최적화 대시보드 | `frontend/pages/process_optimization/`, `frontend/common/casting/` | 목업 데이터, `/casting/process-optimization` 연결 |
| 메인 대시보드 | `frontend/pages/main_dashboard/` | 공지·일정 하드코딩, 메모 localStorage, `/` 연결 |
| 작업자 안전 관리 대시보드 | `frontend/pages/worker_safety/` | 목업 기록 하드코딩, `/safety/worker-safety` 연결 |

## 다른 폴더

- 타 폴더: **읽기만**, 수정 금지. 이상 시 `전달사항/`에 남깁니다.