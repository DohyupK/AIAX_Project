# 페이지·사이드바 등록표

이 파일은 **프로젝트 루트**에 있습니다. (`DH/` 등 개인 폴더 안이 **아닙니다**.)

루트는 여기 적힌 **상대경로**만 호출합니다.  
페이지·API·로직 구현은 각 개인 폴더(`JH` ~ `DH`) 안에서만 합니다.

## 등록 규칙

- **이 파일(루트 `page_registry.md`)만** 팀원 전원이 쓸 수 있습니다. (그 외 루트 수정 → **DH에게 문의**)
- DH는 루트 **권한 창구**이지, 등록표를 DH 폴더에 둔다는 뜻이 아닙니다.
- 등록 전 에이전트/작업자는 사용자에게 반드시 묻습니다:  
  **「기능과 무관하며 이 페이지를 추가하시겠습니까?」**
- 거절이면 이 파일을 바꾸지 않습니다. 개인 폴더 작업은 계속 가능합니다.
- 이 승인으로 기능 코드·라이브러리 추가를 대신하지 않습니다.  
  기능 구현은 별도 **【구현 전에 확인 부탁드립니다】** 승인이 필요합니다.

## 등록 표

| id | 표시명(사이드바) | 소유자 | 상대경로(개인 main/페이지 엔트리) | 비고 | 등록일 |
|----|------------------|--------|-----------------------------------|------|--------|
| platform_index | 주조·프레스 공정 안전 플랫폼 | JH | JH/main | 루트 layout 전체 화면 셸로 사용 (DH 승인) | 2026-11-06 |
| model_management | Model Management | JH | JH/main/model_management | 루트 `app/model-management/page.tsx`에서 호출 (DH 승인) | 2026-11-10 |
| quality_inspection | 품질 검사 | JH | JH/main/quality_inspection | 루트 `app/casting/quality-inspection/page.tsx`에서 호출. ML/DL 미연결, 목업 데이터로 동작 | 2026-11-14 |
| defect_labeling | 불량 유형 라벨링 | JH | JH/main/defect_labeling | 루트 `app/casting/defect-labeling/page.tsx`에서 호출. 주조 공정 대시보드 하위(품질 검사 다음). 2차(DL) 불량 샷 라벨링, 저장은 브라우저 목업(DB 연결 전) | 2026-11-15 |
| company_documents | 사내 문서함 | JH | JH/main/company_documents | 루트 `app/documents/page.tsx`. 사이드바 하단. JH API `/api/documents` → DOCUMENT_ROOT + org 문서/청크/임베딩. 의미검색·BG 청킹. (페이지 추가 아님·비고 갱신) | 2026-11-15 |
| hyejin_bot | Shift | DH | DH/main/hyejin_bot | 표시명 Shift. 전역 FAB(`app/layout`). JH `/api/documents/ask` — 문서 RAG + 관리도 알림. `/hyejin-bot`→`/` | 2026-11-19 |
| hr_management | 인사 관리 | JH | JH/main/hr_management | 루트 `app/hr/page.tsx`에서 호출. 사이드바 보호구 착용 위반 대시보드와 경영 관리자 리포트 사이. 데이터는 `JH/api` 인사 API(FastAPI)로 NCP DB `org` 원본 실시간 조회·변경. 로그인 전이라 목업 계정 선택, API는 127.0.0.1 전용 | 2026-11-16 |
| management_report | 경영 관리자 리포트 | JH | JH/main/management_report | 루트 `app/management-report/page.tsx`에서 호출. 일일·주간·월간 목업 리포트 | 2026-11-14 |
| ppe_violation | 보호구 착용 위반 대시보드 | JH | JH/main/ppe_violation | 루트 `app/safety/ppe-violation/page.tsx`에서 호출 (DH 승인). 옛 이름 작업자 안전 관리(worker_safety)에서 명칭·경로 변경. 검색대 기록·월간 위반 보고서는 목업(DB 연결 전) | 2026-11-17 |
| al_price | 알루미늄 가격 | DH | DH/main/al_price | 루트 `app/al-price/page.tsx`. 조회 `/al-price/api/prices`→serve :8766. `org.aluminum_price` | 2026-11-20 |

## 추가할 때 채울 열

1. `id` — 영문/숫자, 팀 내 유일  
2. `표시명` — 사이드바에 보일 한글/이름  
3. `소유자` — `JH` | `HJ` | `TM` | `MS` | `DH`  
4. `상대경로` — 루트 기준 상대경로 (절대경로 금지)  
5. `비고` — 노출 여부 등  
6. `등록일` — YYYY-MM-DD  
