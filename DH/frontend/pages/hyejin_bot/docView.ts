/** 원문 보기 방식 — JH company_documents viewModeOf 와 동일 규칙 */
export type ViewMode = "pdf" | "image" | "convert" | "text" | "none";

const BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";

export function extOf(fileName: string): string {
  const i = fileName.lastIndexOf(".");
  return i > 0 ? fileName.slice(i + 1).toLowerCase() : "";
}

export function viewModeOf(fileName: string): ViewMode {
  const ext = extOf(fileName);
  if (ext === "pdf") return "pdf";
  if (["png", "jpg", "jpeg"].includes(ext)) return "image";
  if (["docx", "xlsx", "pptx"].includes(ext)) return "convert";
  if (["hwp", "hwpx", "txt", "md"].includes(ext)) return "text";
  return "none";
}

function employeeHeader(): HeadersInit {
  return { "X-Employee-No": "e0001" };
}

export function fileInlineUrl(idx: number): string {
  return `${BASE}/api/documents/${idx}/file?inline=1`;
}

export async function fetchDocText(idx: number): Promise<{ text: string; truncated: boolean }> {
  const res = await fetch(`${BASE}/api/documents/${idx}/text`, {
    headers: employeeHeader(),
    cache: "no-store",
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(t || `본문 조회 실패 (HTTP ${res.status})`);
  }
  const data = (await res.json()) as { text: string; truncated: boolean };
  return { text: data.text ?? "", truncated: !!data.truncated };
}

export async function fetchDocPreviewBlobUrl(idx: number): Promise<string> {
  const res = await fetch(`${BASE}/api/documents/${idx}/preview`, {
    headers: employeeHeader(),
    cache: "no-store",
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(t || `미리보기 실패 (HTTP ${res.status})`);
  }
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}
