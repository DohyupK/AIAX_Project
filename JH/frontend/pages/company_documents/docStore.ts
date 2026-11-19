// 사내 문서함 저장소 — JH API /api/documents (DOCUMENT_ROOT + org.company_document)
import { isCategory, type DocMeta } from './docs';

const BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://127.0.0.1:8000';

function employeeHeader(): HeadersInit {
  // 로그인 전: currentUser 사번을 헤더로 (서버 FK = org.employee)
  try {
    // 동적 import 순환 피함 — 호출측에서 헤더를 넘기지 않고 기본 e0001
  } catch { /* ignore */ }
  return { 'X-Employee-No': 'e0001' };
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { ...employeeHeader(), ...(init?.headers ?? {}) },
    cache: 'no-store',
  });
  if (res.status === 204) return undefined as T;
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || `/api/documents 실패 (HTTP ${res.status})`);
  }
  if (res.headers.get('content-type')?.includes('application/json')) {
    return res.json() as Promise<T>;
  }
  return undefined as T;
}

function mapMeta(row: Record<string, unknown>): DocMeta {
  return {
    company_document_idx: Number(row.company_document_idx),
    doc_no: String(row.doc_no ?? `DOC-${row.company_document_idx}`),
    title: String(row.title ?? ''),
    description: String(row.description ?? ''),
    category: isCategory(String(row.category ?? '')) ? (row.category as DocMeta['category']) : 'regulation',
    grade: (row.grade as DocMeta['grade']) || 'internal',
    department: String(row.department ?? ''),
    uploader_id: String(row.uploader_id ?? ''),
    uploader: String(row.uploader ?? ''),
    created_at: String(row.created_at ?? ''),
    file_name: String(row.file_name ?? ''),
    file_size: Number(row.file_size ?? 0),
    chunk_status: row.chunk_status != null ? String(row.chunk_status) : undefined,
  };
}

/** 업로드된 문서 정보 목록 (파일 본문 제외) */
export async function listDocs(): Promise<DocMeta[]> {
  const rows = await api<Record<string, unknown>[]>('/api/documents');
  return (rows ?? []).map(mapMeta);
}

/** 문서 등록 — multipart → 서버 DOCUMENT_ROOT + org */
export async function addDoc(meta: DocMeta, blob: Blob): Promise<DocMeta> {
  const fd = new FormData();
  fd.append('file', blob, meta.file_name);
  fd.append('title', meta.title);
  fd.append('category', meta.category);
  const res = await fetch(`${BASE}/api/documents`, {
    method: 'POST',
    headers: { 'X-Employee-No': meta.uploader_id || 'e0001' },
    body: fd,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || `업로드 실패 (HTTP ${res.status})`);
  }
  return mapMeta(await res.json());
}

/** 문서 삭제 (정보 + 파일 본문) — company_document_idx 기준 */
export async function deleteDoc(docNoOrIdx: string | number): Promise<void> {
  const idx = typeof docNoOrIdx === 'number'
    ? docNoOrIdx
    : Number(String(docNoOrIdx).replace(/^DOC-/i, ''));
  if (!Number.isFinite(idx)) throw new Error('문서 번호가 올바르지 않습니다.');
  await api<void>(`/api/documents/${idx}`, { method: 'DELETE' });
}

/** 다운로드용 파일 본문 */
export async function getDocBlob(docNoOrIdx: string | number): Promise<Blob | null> {
  const idx = typeof docNoOrIdx === 'number'
    ? docNoOrIdx
    : Number(String(docNoOrIdx).replace(/^DOC-/i, ''));
  if (!Number.isFinite(idx)) return null;
  const res = await fetch(`${BASE}/api/documents/${idx}/file`, {
    headers: employeeHeader(),
    cache: 'no-store',
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`다운로드 실패 (HTTP ${res.status})`);
  return res.blob();
}

export interface SearchHit {
  score: number;
  company_document_idx: number;
  doc_no: string;
  title: string;
  file_name: string;
  category: string;
  chunk_no: number;
  content: string;
}

/** 의미 검색 (OpenAI 임베딩 + 청크 유사도) */
export async function searchDocs(query: string, limit = 10): Promise<SearchHit[]> {
  return api<SearchHit[]>('/api/documents/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...employeeHeader() },
    body: JSON.stringify({ query, limit }),
  });
}
