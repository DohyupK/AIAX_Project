# JH / main

루트가 호출하는 진입점입니다.  
하위의 `frontend/pages/<기능>` · `api/<기능>` 을 여기서 등록·연결합니다.

## 기능 레지스트리

| 기능 id | frontend 상대경로 | api 상대경로 | 비고 |
|---------|-------------------|--------------|------|
| platform_index | ../frontend/pages/platform_index | (없음) | 공통 셸, `main/index.ts` 에서 export. 제목 클릭 → `/` |
| process_optimization | ../frontend/pages/process_optimization (+ ../frontend/common/casting) | (목업 JSON, 실제 API 미연결) | `main/process_optimization.ts` → 루트 app/casting/process-optimization |
| main_dashboard | ../frontend/pages/main_dashboard | (없음, 하드코딩) | `main/main_dashboard.ts` → 루트 app/page.tsx |
| worker_safety | ../frontend/pages/worker_safety | (없음, 목업 하드코딩) | `main/worker_safety.ts` → 루트 app/safety/worker-safety |
