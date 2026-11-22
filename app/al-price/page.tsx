// 알루미늄 가격 — DH/main 만 호출
import { AlPrice } from "@/DH/main/al_price";

export const metadata = { title: "알루미늄 가격" };

export default function Page() {
  return <AlPrice />;
}
