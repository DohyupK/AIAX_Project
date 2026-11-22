// 사내 문서함 저장소 — JH API /api/documents
import { isCategory, type DocMeta } from './docs';

const BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://127.0.0.1:8000';

// 올린 사람·삭제 권한 = 로그인 세션 쿠키 (서버 판단, 화면은 사번을 보내지 않음)
async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: init?.headers,
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
    category: isCategory(String(row.category ?? '')) ? (row.category as DocMeta['category']) : 'regulation',
    uploader_id: String(row.uploader_id ?? ''),
    uploader: String(row.uploader ?? ''),
    created_at: String(row.created_at ?? ''),
    file_name: String(row.file_name ?? ''),
    file_size: Number(row.file_size ?? 0),
    chunk_status: row.chunk_status != null ? String(row.chunk_status) : undefined,
  };
}

export async function listDocs(): Promise<DocMeta[]> {
  const rows = await api<Record<string, unknown>[]>('/api/documents');
  return (rows ?? []).map(mapMeta);
}

export async function addDoc(meta: DocMeta, blob: Blob): Promise<DocMeta> {
  const fd = new FormData();
  fd.append('file', blob, meta.file_name);
  fd.append('title', meta.title);
  fd.append('category', meta.category);
  const res = await fetch(`${BASE}/api/documents`, {
    method: 'POST',
    body: fd,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || `업로드 실패 (HTTP ${res.status})`);
  }
  return mapMeta(await res.json());
}

export async function deleteDoc(docNoOrIdx: string | number): Promise<void> {
  const idx = typeof docNoOrIdx === 'number'
    ? docNoOrIdx
    : Number(String(docNoOrIdx).replace(/^DOC-/i, ''));
  if (!Number.isFinite(idx)) throw new Error('문서 번호가 올바르지 않습니다.');
  await api<void>(`/api/documents/${idx}`, { method: 'DELETE' });
}

export async function getDocBlob(docNoOrIdx: string | number): Promise<Blob | null> {
  const idx = typeof docNoOrIdx === 'number'
    ? docNoOrIdx
    : Number(String(docNoOrIdx).replace(/^DOC-/i, ''));
  if (!Number.isFinite(idx)) return null;
  const res = await fetch(`${BASE}/api/documents/${idx}/file`, { cache: 'no-store' });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`다운로드 실패 (HTTP ${res.status})`);
  return res.blob();
}

/** 문서 번호(DOC-3 또는 3) → 숫자 */
const idxOf = (docNoOrIdx: string | number) =>
  typeof docNoOrIdx === 'number' ? docNoOrIdx : Number(String(docNoOrIdx).replace(/^DOC-/i, ''));

/** docx·xlsx·pptx 의 PDF 변환본. 서버에 변환 도구(LibreOffice)가 없으면 null → 본문 텍스트로 대신 */
export async function getDocPreview(docNoOrIdx: string | number): Promise<Blob | null> {
  const res = await fetch(`${BASE}/api/documents/${idxOf(docNoOrIdx)}/preview`, { cache: 'no-store' });
  if (res.status === 501) return null;
  if (!res.ok) throw new Error(`PDF 변환 실패 (HTTP ${res.status})`);
  return res.blob();
}

/** 본문 텍스트 (최대 2만 자, 넘으면 truncated) */
export const getDocText = (docNoOrIdx: string | number) =>
  api<{ text: string; truncated: boolean; chars: number }>(`/api/documents/${idxOf(docNoOrIdx)}/text`);

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

export async function searchDocs(query: string, limit = 10): Promise<SearchHit[]> {
  return api<SearchHit[]>('/api/documents/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, limit }),
  });
}
