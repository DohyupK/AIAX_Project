// Shift 봇 → JH FastAPI POST /api/documents/ask (멀티턴·화면 맥락). 대화 DB 저장 없음.
import { hitToSource, type ChatSource, type DocSearchHit } from "./sources";
import type { UiContextSnapshot } from "./uiContext";

const BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";
const FETCH_MS = 30_000;
const MAX_HISTORY = 6;

export interface AskResult {
  answer: string;
  sources: ChatSource[];
}

export interface ChatHistoryMsg {
  role: "user" | "assistant";
  content: string;
}

interface AskApiResponse {
  answer: string;
  sources: DocSearchHit[];
}

/** Shift: JH /ask — 문서 + 알림 + KPI + 멀티턴 (대화 테이블 없음) */
export async function askHyejinBot(query: string): Promise<AskResult> {
  return askShiftBot(query);
}

export async function askShiftBot(
  query: string,
  opts?: { history?: ChatHistoryMsg[]; uiContext?: UiContextSnapshot },
): Promise<AskResult> {
  const q = query.trim();
  if (!q) return { answer: "질문을 입력해 주세요.", sources: [] };

  const history = (opts?.history ?? [])
    .filter((m) => (m.role === "user" || m.role === "assistant") && m.content.trim())
    .slice(-MAX_HISTORY)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 4000) }));

  const ui = opts?.uiContext;
  const body: Record<string, unknown> = { query: q, limit: 10, history };
  if (ui) {
    body.ui_context = {
      path: ui.path.slice(0, 200),
      page_label: ui.page_label.slice(0, 80),
      actions: (ui.actions ?? []).slice(-15).map((a) => ({
        t: a.t,
        kind: a.kind,
        label: (a.label || "").slice(0, 80),
      })),
    };
  }

  let data: AskApiResponse;
  try {
    const res = await fetch(`${BASE}/api/documents/ask`, {
      method: "POST",
      cache: "no-store",
      signal: AbortSignal.timeout(FETCH_MS),
      headers: { "Content-Type": "application/json", "X-Employee-No": "e0001" },
      body: JSON.stringify(body),
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
