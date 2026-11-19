// 혜진봇 → JH FastAPI /api/documents/search 만 호출 (DH API 서버 없음, JH 수정 없음)
import {
  buildAnswerFromChunks,
  hitToSource,
  searchCastingSources,
  type ChatSource,
  type DocSearchHit,
} from "./sources";

const BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";
const FETCH_MS = 15_000;

export interface AskResult {
  answer: string;
  sources: ChatSource[];
}

async function searchDocuments(query: string, limit = 10): Promise<DocSearchHit[]> {
  const res = await fetch(`${BASE}/api/documents/search`, {
    method: "POST",
    cache: "no-store",
    signal: AbortSignal.timeout(FETCH_MS),
    headers: { "Content-Type": "application/json", "X-Employee-No": "e0001" },
    body: JSON.stringify({ query, limit }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `/api/documents/search 실패 (HTTP ${res.status})`);
  }
  return (await res.json()) as DocSearchHit[];
}

/** Phase A: 문서 검색 → 템플릿 답 + sources. casting은 stub 합치기만 */
export async function askHyejinBot(query: string): Promise<AskResult> {
  const q = query.trim();
  if (!q) return { answer: "질문을 입력해 주세요.", sources: [] };

  let hits: DocSearchHit[] = [];
  try {
    hits = await searchDocuments(q, 10);
  } catch (e) {
    if (e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError")) {
      throw new Error("문서 검색 시간 초과 (15초) — 서버 DB·OPENAI_API_KEY 확인");
    }
    throw e;
  }

  const docSources = hits.map(hitToSource);
  // casting stub (빈 배열) — 이후 분석 자료 소스 병합
  const casting = await searchCastingSources(q);
  const sources = [...docSources, ...casting];

  return {
    answer: buildAnswerFromChunks(q, hits),
    sources,
  };
}
