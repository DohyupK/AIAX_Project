// 혜진봇 — DH/main 만 호출 (2026-11-19 등록)
import { HyejinBot } from "@/DH/main/hyejin_bot";

export const metadata = { title: "혜진봇" };

export default function Page() {
  return <HyejinBot />;
}
