// JH main 진입점 — 루트는 JH/main 아래 파일만 import 합니다
// 셸은 서버 PlatformLayout + 클라이언트 PlatformIndex 로 분리 (번들·하이드레이션 절감)
export { PlatformLayout } from "../frontend/pages/platform_index/PlatformLayout";
export { PlatformIndex } from "../frontend/pages/platform_index/PlatformIndex";
