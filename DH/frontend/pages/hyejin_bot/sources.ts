// 혜진봇 검색 소스 종류 — Phase A는 company_document만. casting은 이후 RAG
export type SourceKind = "company_document" | "casting";

/** 챗봇 출처 1건 (UI·답변에 항상 포함) */
export interface ChatSource {
  kind: SourceKind;
  company_document_idx: number;
  doc_no: string;
  title: string;
  file_name: string;
  category: string;
  chunk_no: number;
  score: number;
  snippet: string;
  /** 원문 다운로드 — JH API */
  file_url: string;
}

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
  sources: ChatSource[];
}

/** JH /api/documents/search 응답 한 줄 */
export interface DocSearchHit {
  score: number;
  company_document_idx: number;
  doc_no: string;
  title: string;
  file_name: string;
  category: string;
  chunk_no: number;
  content: string;
}

const BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";

export function fileUrlFor(company_document_idx: number): string {
  return `${BASE}/api/documents/${company_document_idx}/file`;
}

export function hitToSource(hit: DocSearchHit): ChatSource {
  return {
    kind: "company_document",
    company_document_idx: hit.company_document_idx,
    doc_no: hit.doc_no,
    title: hit.title,
    file_name: hit.file_name,
    category: hit.category ?? "",
    chunk_no: hit.chunk_no,
    score: hit.score,
    snippet: (hit.content ?? "").slice(0, 400),
    file_url: fileUrlFor(hit.company_document_idx),
  };
}

/**
 * Phase A: 청크를 묶어 답 텍스트 생성 (LLM 없음).
 * ponytail Phase B: generateAnswerWithLlm(query, sources) — OpenAI Chat + 동일 sources
 */
export function buildAnswerFromChunks(query: string, hits: DocSearchHit[]): string {
  if (!hits.length) {
    return "사내 문서에서 근거를 찾지 못했습니다. 문서함 업로드·청킹(ok) 상태를 확인해 주세요.";
  }
  const lines = [
    `「${query}」에 대해 사내 문서에서 찾은 근거입니다.`,
    "",
    ...hits.map((h, i) => {
      const body = (h.content ?? "").trim().slice(0, 500);
      return `${i + 1}. [${h.doc_no}] ${h.title} (chunk ${h.chunk_no}, score ${h.score})\n${body}`;
    }),
    "",
    "아래 출처에서 원문을 열람할 수 있습니다.",
  ];
  return lines.join("\n");
}

/** ponytail: casting 분석 자료 RAG — 이후 SourceKind 'casting' 구현 */
export async function searchCastingSources(_query: string): Promise<ChatSource[]> {
  return [];
}
