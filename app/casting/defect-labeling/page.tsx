// 불량 유형 라벨링 — JH/main 만 호출 (2026-11-15 등록)
import { DefectLabeling } from "@/JH/main/defect_labeling";

export const metadata = { title: "불량 유형 라벨링" };

export default function Page() {
  return <DefectLabeling />;
}
