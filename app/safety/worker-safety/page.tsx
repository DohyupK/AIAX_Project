// 작업자 안전 관리 대시보드 — JH/main 만 호출 (DH 승인 2026-11-07)
import { WorkerSafetyDashboard } from "@/JH/main/worker_safety";

export const metadata = { title: "작업자 안전 관리 대시보드" };

export default function Page() {
  return <WorkerSafetyDashboard />;
}
