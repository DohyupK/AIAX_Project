// Shift 봇은 루트 layout 전역 FAB — 이 경로는 홈으로 안내
import { redirect } from "next/navigation";

export const metadata = { title: "Shift" };

export default function Page() {
  redirect("/");
}
