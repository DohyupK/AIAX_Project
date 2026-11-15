# JH / main

루트가 호출하는 진입점입니다.  
하위의 `frontend/pages/<기능>` · `api/<기능>` 을 여기서 등록·연결합니다.

## 기능 레지스트리

| 기능 id | frontend 상대경로 | api 상대경로 | 비고 |
|---------|-------------------|--------------|------|
| platform_index | ../frontend/pages/platform_index | (없음) | 공통 셸, `main/index.ts` 에서 export. 제목 클릭 → `/` |
| process_optimization | ../frontend/pages/process_optimization (+ ../frontend/common/casting) | (목업 JSON, 실제 API 미연결) | `main/process_optimization.ts` → 루트 app/casting/process-optimization |
| quality_inspection | ../frontend/pages/quality_inspection (+ process_optimization 의 SensorMonitor·CSS 재사용) | (목업 JSON. 2차(DL) 판정은 실제 라벨로 대체, `inspection.ts`) | `main/quality_inspection.ts` → 루트 app/casting/quality-inspection |
| management_report | ../frontend/pages/management_report (+ worker_safety 의 GEAR_LABEL 참조) | (목업 data.ts, 실제 API 미연결) | `main/management_report.ts` → 루트 app/management-report |
| main_dashboard | ../frontend/pages/main_dashboard | (없음, 하드코딩) | `main/main_dashboard.ts` → 루트 app/page.tsx |
| worker_safety | ../frontend/pages/worker_safety | (없음, 목업 하드코딩) | `main/worker_safety.ts` → 루트 app/safety/worker-safety |
