// JH main 진입점 — 루트는 JH/main 아래 파일만 import 합니다
// 셸은 서버 PlatformLayout + 클라이언트 PlatformIndex(사이드바·헤더) 로 분리 (번들·하이드레이션 절감)
export { PlatformLayout } from "../frontend/pages/platform_index/PlatformLayout";
export { PlatformIndex } from "../frontend/pages/platform_index/PlatformIndex";
// 라이트/다크 모드 — 루트 layout <head>에서 첫 화면 깜빡임 방지
export { ThemeScript } from "../frontend/common/theme/ThemeScript";
