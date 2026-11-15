// 품질 검사 대시보드 — JH/main 만 호출 (2026-11-14 등록)
import { QualityInspectionDashboard } from "@/JH/main/quality_inspection";

export const metadata = { title: "품질 검사 대시보드" };

export default function Page() {
  return <QualityInspectionDashboard />;
}
