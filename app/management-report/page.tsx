// 경영 관리자 리포트 — JH/main 만 호출 (2026-11-14 등록)
import { ManagementReport } from "@/JH/main/management_report";

export const metadata = { title: "경영 관리자 리포트" };

export default function Page() {
  return <ManagementReport />;
}
