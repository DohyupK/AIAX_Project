// 로그인 — JH/main 만 호출 (DH 승인·page_registry 2026-11-21)
import { Login } from "@/JH/main/auth";

export const metadata = { title: "로그인 · Shift" };

export default function Page() {
  return <Login />;
}
