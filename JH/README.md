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

## PC·모바일 UI 규격 (필수)

화면 디자인·레이아웃을 만들거나 바꿀 때 **PC 최적 UI**와 **모바일 최적 UI**를 같은 작업에서 둘 다 구현한다. Pass/Fail은 [frontend/모바일_페이지_규격.md](frontend/모바일_페이지_규격.md). 클로드·에이전트 세션에는 루트 `AGENTS.md`(5-2절)를 포함한다.

## 기능 목록

| 기능 | 경로 | 상태 |
|------|------|------|
| 공정 안전 플랫폼 인덱스 | `frontend/pages/platform_index/` | 루트 layout 연결 |
| 공정 최적화 대시보드 | `frontend/pages/process_optimization/`, `frontend/common/casting/` | 목업 데이터, `/casting/process-optimization` 연결 |
| 메인 대시보드 | `frontend/pages/main_dashboard/`, `api/notice/` | 일정·예시 공지 하드코딩, 일일 공정알람 AI 공지 API, 메모 쿠키, `/` 연결 |
| 보호구 착용 위반 대시보드 | `frontend/pages/ppe_violation/` | 목업 기록 하드코딩, 월별 위반 보고서 팝업, `/safety/ppe-violation` 연결 |
| 교대 인수인계 리포트 | `frontend/pages/shift_handover/`, `main/shift_handover.ts` | 사이드바 「인수인계 실행」·자동 팝업·PDF. 루트 `app/layout` 마운트. casting API 재사용 |

## 다른 폴더

- 타 폴더: **읽기만**, 수정 금지. 이상 시 `전달사항/`에 남깁니다.