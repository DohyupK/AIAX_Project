# 전달사항 — 공정 최적화 루트 변경 요청 (JH → DH)

- 작성: JH, 2026-11-11
- 대상: 루트 권한자 DH
- 상태: **완료 (2026-11-11 루트 승인 후 JH 세션에서 1·2·3 모두 반영, 호환용 별칭 `JH/main/temperature_control.ts` 삭제)**

## 배경
JH의 "온도 제어" 화면을 "공정 최적화"로 개편했습니다. JH 폴더 안의 이름·경로는 모두 바뀌었고, 루트에만 옛 이름이 남아 있습니다.

## 요청
1. `app/casting/temperature-control/page.tsx`
   - import: `@/JH/main/temperature_control` 의 `TemperatureControlDashboard`
     → `@/JH/main/process_optimization` 의 `ProcessOptimizationDashboard`
   - `metadata.title`: `"온도 제어 대시보드"` → `"공정 최적화 대시보드"`
   - 첫 줄 주석의 "온도 제어" → "공정 최적화"
2. (선택) URL을 `/casting/temperature-control` → `/casting/process-optimization` 으로 바꿀 경우
   - 폴더명 변경 후 JH에 알려 주세요. JH가 사이드바(`PlatformIndex.tsx`) 링크를 맞춥니다.
3. `DB연동_내역/2026-11-06_JH_temperature_control.md`
   - 기능명을 공정 최적화(process_optimization)로 정정
   - 일별 집계(`/api/casting/daily`, `mock/daily.json`)는 화면에서 빠져 더 이상 사용하지 않음

## 지금 상태
- 1번 반영 전에도 화면은 정상 동작합니다. JH가 `JH/main/temperature_control.ts`를 호환용 별칭으로 남겨 두었습니다.
- 1번 반영 후 JH가 그 별칭 파일을 삭제합니다.
