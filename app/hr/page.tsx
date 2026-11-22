// 인사 관리 — JH/main 만 호출 (2026-11-16 등록)
import { HrManagement } from "@/JH/main/hr_management";

export const metadata = { title: "인사 관리" };

export default function Page() {
  return <HrManagement />;
}
