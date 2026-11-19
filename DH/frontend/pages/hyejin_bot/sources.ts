// 혜진봇 검색 소스 — company_document. casting은 이후 RAG
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

/** JH /api/documents/ask · /search 응답 sources 한 줄 */
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

/** ponytail: casting 분석 자료 RAG — 이후 SourceKind 'casting' 구현 */
export async function searchCastingSources(_query: string): Promise<ChatSource[]> {
  return [];
}
