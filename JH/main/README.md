# JH / main

루트가 호출하는 진입점입니다.  
하위의 `frontend/pages/<기능>` · `api/<기능>` 을 여기서 등록·연결합니다.

## 기능 레지스트리

| 기능 id | frontend 상대경로 | api 상대경로 | 비고 |
|---------|-------------------|--------------|------|
| platform_index | ../frontend/pages/platform_index | (없음) | 공통 셸, `main/index.ts` 에서 export. 제목 클릭 → `/` |
| process_optimization | ../frontend/pages/process_optimization (+ ../frontend/common/casting) | (목업 JSON, 실제 API 미연결) | `main/process_optimization.ts` → 루트 app/casting/process-optimization |
| defect_labeling | ../frontend/pages/defect_labeling (+ quality_inspection 의 inspection·KeyVariables, common/casting/MockShotImage) | (목업 JSON + 라벨은 브라우저 localStorage, `labels.ts`. DB API 연결 예정) | `main/defect_labeling.ts` → 루트 app/casting/defect-labeling |
| company_documents | ../frontend/pages/company_documents | (예시 문서 + 업로드는 브라우저 IndexedDB, `docStore.ts`. 문서 API·파일 서버 연결 예정) | `main/company_documents.ts` → 루트 app/documents |
| quality_inspection | ../frontend/pages/quality_inspection (+ process_optimization 의 SensorMonitor·CSS 재사용) | (목업 JSON. 2차(DL) 판정은 실제 라벨로 대체, `inspection.ts`) | `main/quality_inspection.ts` → 루트 app/casting/quality-inspection |
| management_report | ../frontend/pages/management_report (+ ppe_violation 의 GEAR_LABEL 참조) | (목업 data.ts, 실제 API 미연결) | `main/management_report.ts` → 루트 app/management-report |
| hr_management | ../frontend/pages/hr_management (+ company_documents·process_optimization CSS 재사용) | ../api/hr (FastAPI, NCP DB `org` 원본 실시간, 계정 `app_hr`). 실행: `cd JH/api && uv run uvicorn main:app --host 127.0.0.1 --port 8000`. 권한 규칙 `api/hr/rules.py` (점검: `uv run python -m hr.rules_check`) | `main/hr_management.ts` → 루트 app/hr. 로그인 전: 목업 계정(X-Employee-No 헤더) |
| main_dashboard | ../frontend/pages/main_dashboard | (없음, 하드코딩) | `main/main_dashboard.ts` → 루트 app/page.tsx |
| ppe_violation | ../frontend/pages/ppe_violation | (없음, 목업 하드코딩: 검색대 기록 data.ts, 월간 보고서 monthly.ts) | `main/ppe_violation.ts` → 루트 app/safety/ppe-violation |
