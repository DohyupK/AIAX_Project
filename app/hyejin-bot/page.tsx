// 혜진봇은 루트 layout 전역 FAB — 이 경로는 홈으로 안내
import { redirect } from "next/navigation";

export const metadata = { title: "혜진봇" };

export default function Page() {
  redirect("/");
}
