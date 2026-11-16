// 공정 최적화 대시보드 — JH/main 만 호출 (DH 승인 2026-11-06, 경로 변경 2026-11-07, 온도 제어 → 공정 최적화 2026-11-11)
import { ProcessOptimizationDashboard } from "@/JH/main/process_optimization";

export const metadata = { title: "공정 최적화 대시보드" };

export default function Page() {
  return <ProcessOptimizationDashboard />;
}
