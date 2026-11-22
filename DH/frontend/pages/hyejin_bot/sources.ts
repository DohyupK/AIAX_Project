// Shift 봇 출처 — 사내 문서 + 관리도 알림 + 품질 KPI
export type SourceKind = "company_document" | "process_alert" | "quality_kpi";

/** 챗봇 출처 1건 */
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
  /** 원문 다운로드 — 문서만 */
  file_url: string;
  grade?: string;
  line?: string;
}

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
  sources: ChatSource[];
}

/** JH /api/documents/ask sources 한 줄 */
export interface DocSearchHit {
  kind?: SourceKind;
  score: number;
  company_document_idx: number;
  doc_no: string;
  title: string;
  file_name: string;
  category: string;
  chunk_no: number;
  content: string;
  grade?: string;
  line?: string;
}

const BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";

export function fileUrlFor(company_document_idx: number): string {
  return `${BASE}/api/documents/${company_document_idx}/file`;
}

function resolveKind(kind?: SourceKind): SourceKind {
  if (kind === "process_alert" || kind === "quality_kpi") return kind;
  return "company_document";
}

export function hitToSource(hit: DocSearchHit): ChatSource {
  const kind = resolveKind(hit.kind);
  return {
    kind,
    company_document_idx: hit.company_document_idx ?? 0,
    doc_no: hit.doc_no,
    title: hit.title,
    file_name: hit.file_name,
    category: hit.category ?? "",
    chunk_no: hit.chunk_no ?? 0,
    score: hit.score,
    snippet: (hit.content ?? "").slice(0, 400),
    file_url: kind === "company_document" && hit.company_document_idx
      ? fileUrlFor(hit.company_document_idx)
      : "",
    grade: hit.grade,
    line: hit.line,
  };
}
