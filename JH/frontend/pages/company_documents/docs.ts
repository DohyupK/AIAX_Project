// 사내 문서함 — 카테고리·업로드 검증 (화면·브라우저 API 없음) — 자체 점검: docs.check.ts
// 서버 org.company_document 칼럼에 맞춤 (title, category, file_*, uploaded_*)

export const CATEGORIES = [
  { key: 'regulation', label: '사규·규정' },
  { key: 'sop', label: '작업표준(SOP)' },
  { key: 'quality', label: '품질 문서' },
  { key: 'safety', label: '안전' },
  { key: 'equipment', label: '설비·보전' },
  { key: 'report', label: '회의록·보고서' },
  { key: 'form', label: '양식·서식' },
] as const;
export type Category = (typeof CATEGORIES)[number]['key'];

/** 업로드 허용 확장자 · 크기 제한 (서버 paths.ALLOWED_EXT 와 동일) */
export const ALLOWED_EXT = ['pdf', 'docx', 'xlsx', 'pptx', 'hwp', 'hwpx', 'txt', 'md', 'png', 'jpg', 'jpeg', 'zip'] as const;
export const MAX_FILE_BYTES = 20 * 1024 * 1024; // 20MB
export const TITLE_MAX = 100;

/** 문서 정보 — 서버 응답 + 화면 */
export interface DocMeta {
  company_document_idx?: number;
  doc_no: string;
  title: string;
  category: Category;
  uploader_id: string;
  uploader: string;
  created_at: string;
  file_name: string;
  file_size: number;
  chunk_status?: string;
}

export const extOf = (fileName: string) => {
  const i = fileName.lastIndexOf('.');
  return i > 0 ? fileName.slice(i + 1).toLowerCase() : '';
};

/**
 * 문서 내용 보기 방식 — pdf: 원본(브라우저 PDF 보기) / image: 이미지 / convert: 서버 PDF 변환본(LibreOffice, 없으면 본문 텍스트)
 * / text: 본문 텍스트 / none: 미리보기 없음(다운로드)
 */
export type ViewMode = 'pdf' | 'image' | 'convert' | 'text' | 'none';
export function viewModeOf(fileName: string): ViewMode {
  const ext = extOf(fileName);
  if (ext === 'pdf') return 'pdf';
  if (['png', 'jpg', 'jpeg'].includes(ext)) return 'image';
  if (['docx', 'xlsx', 'pptx'].includes(ext)) return 'convert';
  if (['hwp', 'hwpx', 'txt', 'md'].includes(ext)) return 'text';
  return 'none';
}

export const formatSize = (b: number) =>
  b < 1024 ? `${b} B` : b < 1024 * 1024 ? `${(b / 1024).toFixed(0)} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`;

const has = <T extends string>(list: readonly { key: T }[], v: string): v is T => list.some(x => x.key === v);
export const isCategory = (v: string): v is Category => has(CATEGORIES, v);

export interface UploadDraft {
  title: string;
  category: string;
  file: { name: string; size: number } | null;
}

/** 업로드 입력 검증 — 서버에 보내는 항목만 */
export function validateUpload(d: UploadDraft): Partial<Record<keyof UploadDraft, string>> {
  const e: Partial<Record<keyof UploadDraft, string>> = {};
  if (!d.file) e.file = '업로드할 파일을 선택하세요.';
  else if (!(ALLOWED_EXT as readonly string[]).includes(extOf(d.file.name)))
    e.file = `허용되지 않는 형식입니다. (${ALLOWED_EXT.join(', ')})`;
  else if (d.file.size <= 0) e.file = '빈 파일은 올릴 수 없습니다.';
  else if (d.file.size > MAX_FILE_BYTES) e.file = `파일이 너무 큽니다. (최대 ${formatSize(MAX_FILE_BYTES)})`;
  const title = d.title.trim();
  if (!title) e.title = '파일 제목을 입력하세요.';
  else if (title.length > TITLE_MAX) e.title = `제목은 ${TITLE_MAX}자 이하로 입력하세요.`;
  if (!isCategory(d.category)) e.category = '카테고리를 선택하세요.';
  return e;
}

export const createdAt = (now: Date = new Date()) => now.toISOString();

export const formatDateTime = (iso: string) => {
  const t = new Date(iso);
  return Number.isNaN(t.getTime()) ? iso : t.toLocaleString('sv-SE').slice(0, 16);
};

/** 삭제: 본인 업로드만 (서버도 동일 검사) */
export const canDelete = (doc: Pick<DocMeta, 'uploader_id'>, user: { user_id: string; admin?: boolean } | null) =>
  !!user && (!!user.admin || !doc.uploader_id || doc.uploader_id === user.user_id);   // 관리자 = 모든 문서

/** 업로드 직전 임시 메타 (서버 응답으로 교체됨) */
export function buildDocMeta(
  d: UploadDraft & { file: { name: string; size: number } },
  user: { user_id: string; name: string },
  now: Date = new Date(),
): DocMeta {
  return {
    doc_no: 'pending',
    title: d.title.trim(),
    category: d.category as Category,
    uploader_id: user.user_id,
    uploader: user.name,
    created_at: createdAt(now),
    file_name: d.file.name,
    file_size: d.file.size,
  };
}

export const sortDocs = (docs: DocMeta[]) =>
  [...docs].sort((a, b) => (Date.parse(b.created_at) || 0) - (Date.parse(a.created_at) || 0) || b.doc_no.localeCompare(a.doc_no));
