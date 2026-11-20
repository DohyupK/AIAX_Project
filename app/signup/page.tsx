// 회원가입 — JH/main 만 호출 (DH 승인·page_registry 2026-11-21)
import { Signup } from "@/JH/main/auth";

export const metadata = { title: "회원가입 · Shift" };

export default function Page() {
  return <Signup />;
}
