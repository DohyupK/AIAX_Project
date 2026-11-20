// Shift 봇 → JH FastAPI POST /api/documents/ask (문서 검색 + 관리도 알림 + Chat)
import { hitToSource, type ChatSource, type DocSearchHit } from "./sources";

const BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";
const FETCH_MS = 30_000;

export interface AskResult {
  answer: string;
  sources: ChatSource[];
}

interface AskApiResponse {
  answer: string;
  sources: DocSearchHit[];
}

/** Shift: JH /ask — 문서 + 관리도 알림 + LLM 답 */
export async function askHyejinBot(query: string): Promise<AskResult> {
  return askShiftBot(query);
}

export async function askShiftBot(query: string): Promise<AskResult> {
  const q = query.trim();
  if (!q) return { answer: "질문을 입력해 주세요.", sources: [] };

  let data: AskApiResponse;
  try {
    const res = await fetch(`${BASE}/api/documents/ask`, {
      method: "POST",
      cache: "no-store",
      signal: AbortSignal.timeout(FETCH_MS),
      headers: { "Content-Type": "application/json", "X-Employee-No": "e0001" },
      body: JSON.stringify({ query: q, limit: 10 }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(text || `/api/documents/ask 실패 (HTTP ${res.status})`);
    }
    data = (await res.json()) as AskApiResponse;
  } catch (e) {
    if (e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError")) {
      throw new Error("Shift 응답 시간 초과 (30초) — 서버 DB·NVIDIA_API_KEY 확인");
    }
    throw e;
  }

  return {
    answer: data.answer ?? "",
    sources: (data.sources ?? []).map(hitToSource),
  };
}
