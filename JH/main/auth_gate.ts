// 페이지 접근 문지기 진입점 — 루트 middleware.ts 전용 (Edge 런타임: 화면 컴포넌트를 섞지 않으려고 auth.ts 와 분리)
export { authGate } from "../frontend/common/auth/gate";
