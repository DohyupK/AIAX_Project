// 혜진봇 → JH FastAPI POST /api/documents/ask (검색 + OpenAI Chat). 키는 서버만.
import {
  hitToSource,
  searchCastingSources,
  type ChatSource,
  type DocSearchHit,
} from "./sources";

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

/** Phase B: JH /ask — 문서 검색 + LLM 답. casting stub 합치기 */
export async function askHyejinBot(query: string): Promise<AskResult> {
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
      throw new Error("혜진봇 응답 시간 초과 (30초) — 서버 DB·OPENAI_API_KEY 확인");
    }
    throw e;
  }

  const docSources = (data.sources ?? []).map(hitToSource);
  const casting = await searchCastingSources(q);
  return {
    answer: data.answer ?? "",
    sources: [...docSources, ...casting],
  };
}
