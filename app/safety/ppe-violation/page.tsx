// 보호구 착용 위반 대시보드 — JH/main 만 호출 (DH 승인 2026-11-07, 명칭·경로 변경 승인 2026-11-17)
import { PpeViolationDashboard } from "@/JH/main/ppe_violation";

export const metadata = { title: "보호구 착용 위반 대시보드" };

export default function Page() {
  return <PpeViolationDashboard />;
}
