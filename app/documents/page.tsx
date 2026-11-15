// 사내 문서함 — JH/main 만 호출 (2026-11-15 등록)
import { CompanyDocuments } from "@/JH/main/company_documents";

export const metadata = { title: "사내 문서함" };

export default function Page() {
  return <CompanyDocuments />;
}
