// JH main 진입점 — 루트는 JH/main 아래 파일만 import 합니다
// 공통 셸(사이드바)만 여기서 export. 페이지는 번들 분리를 위해 페이지별 파일로 export (main_dashboard.ts, process_optimization.ts)
export { PlatformIndex, PlatformLayout } from "../frontend/pages/platform_index/PlatformIndex";
