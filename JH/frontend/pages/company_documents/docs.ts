// 사내 문서함 — 분류·보안 등급·업로드 검증·문서 번호 (화면·브라우저 API 없음) — 자체 점검: docs.check.ts

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

/** 보안 등급 (낮음 → 높음). ponytail: 지금은 표시용 — 로그인·권한 관리 도입 시 등급별 열람 제한 추가 */
export const GRADES = [
  { key: 'public', label: 'Public', ko: '공개 — 외부 공개 가능' },
  { key: 'internal', label: 'Internal', ko: '사내 — 임직원 누구나 열람' },
  { key: 'private', label: 'Private', ko: '부서 한정 — 작성 부서·관계자만' },
  { key: 'confidential', label: 'Confidential', ko: '대외비 — 승인된 인원만' },
  { key: 'top_secret', label: 'Top Secret', ko: '극비 — 지정된 인원만, 반출 금지' },
] as const;
export type Grade = (typeof GRADES)[number]['key'];

export const DEPARTMENTS = ['경영지원팀', '생산팀', '품질팀', '안전환경팀', '설비보전팀', '연구개발팀'] as const;

/** 업로드 허용 확장자 · 크기 제한 */
export const ALLOWED_EXT = ['pdf', 'docx', 'xlsx', 'pptx', 'hwp', 'hwpx', 'txt', 'png', 'jpg', 'jpeg', 'zip'] as const;
export const MAX_FILE_BYTES = 20 * 1024 * 1024; // 20MB — 브라우저 저장 목업 기준
export const TITLE_MAX = 100;
export const DESC_MAX = 500;

/** 문서 정보 — 서버 org.company_document + 화면용 보조 필드 */
export interface DocMeta {
  company_document_idx?: number; // 서버 PK
  doc_no: string;          // DOC-{idx} 또는 예시 DOC-YYYY-NNNN
  title: string;
  description: string;
  category: Category;
  grade: Grade;
  department: string;
  uploader_id: string;     // org.employee.employee_no
  uploader: string;
  created_at: string;
  file_name: string;
  file_size: number;
  sample?: boolean;
  chunk_status?: string;   // pending|ok|retry_5m|midnight_pending
}

export const extOf = (fileName: string) => {
  const i = fileName.lastIndexOf('.');
  return i > 0 ? fileName.slice(i + 1).toLowerCase() : '';
};

export const formatSize = (b: number) =>
  b < 1024 ? `${b} B` : b < 1024 * 1024 ? `${(b / 1024).toFixed(0)} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`;

const has = <T extends string>(list: readonly { key: T }[], v: string): v is T => list.some(x => x.key === v);
export const isCategory = (v: string): v is Category => has(CATEGORIES, v);
export const isGrade = (v: string): v is Grade => has(GRADES, v);

export interface UploadDraft {
  title: string; description: string; category: string; grade: string; department: string;
  file: { name: string; size: number } | null;
}

/** 업로드 입력 검증 — 항목별 오류 문구 (비어 있으면 통과) */
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
  if (d.description.length > DESC_MAX) e.description = `설명은 ${DESC_MAX}자 이하로 입력하세요.`;
  if (!isCategory(d.category)) e.category = '카테고리를 선택하세요.';
  if (!isGrade(d.grade)) e.grade = '보안 등급을 선택하세요.';
  if (!(DEPARTMENTS as readonly string[]).includes(d.department)) e.department = '작성 부서를 선택하세요.';
  return e;
}

/** 등록 일시 — 등록 버튼을 누른 순간의 시각 (ISO 8601, UTC). 서버 연결 시 서버 시각으로 교체 */
export const createdAt = (now: Date = new Date()) => now.toISOString();

/** 화면 표시용 일시 — 브라우저 현지 시각 YYYY-MM-DD HH:mm (날짜만 있는 옛 값도 처리) */
export const formatDateTime = (iso: string) => {
  const t = new Date(iso);
  return Number.isNaN(t.getTime()) ? iso : t.toLocaleString('sv-SE').slice(0, 16);
};

/** 삭제 가능 여부 — 업로드한 본인만. 예시 문서·로그인 안 됨은 불가. 업로더 정보 없는 옛 문서는 허용(주인 없음)
 *  ponytail: 화면 단 확인일 뿐 — 서버 API 연결 시 서버에서도 같은 검사 필수 */
export const canDelete = (doc: Pick<DocMeta, 'sample' | 'uploader_id'>, user: { user_id: string } | null) =>
  !doc.sample && !!user && (!doc.uploader_id || doc.uploader_id === user.user_id);

/** 검증 통과한 입력 + 로그인 계정 + 등록 시각 → 저장할 문서 정보 */
export function buildDocMeta(
  d: UploadDraft & { file: { name: string; size: number } },
  user: { user_id: string; name: string },
  docNo: string,
  now: Date = new Date(),
): DocMeta {
  return {
    doc_no: docNo, title: d.title.trim(), description: d.description.trim(),
    category: d.category as Category, grade: d.grade as Grade, department: d.department,
    uploader_id: user.user_id, uploader: user.name, created_at: createdAt(now),
    file_name: d.file.name, file_size: d.file.size,
  };
}

/** 다음 문서 번호 — 같은 연도의 가장 큰 번호 + 1 (DOC-YYYY-NNNN) */
export function nextDocNo(existing: string[], year: number): string {
  const prefix = `DOC-${year}-`;
  const max = existing
    .filter(n => n.startsWith(prefix))
    .map(n => Number(n.slice(prefix.length)))
    .filter(Number.isInteger)
    .reduce((a, b) => Math.max(a, b), 0);
  return `${prefix}${String(max + 1).padStart(4, '0')}`;
}

/** 최신 등록순 (같은 시각이면 문서 번호 역순) — 시간대가 섞여도 맞도록 시각 값으로 비교 */
export const sortDocs = (docs: DocMeta[]) =>
  [...docs].sort((a, b) => (Date.parse(b.created_at) || 0) - (Date.parse(a.created_at) || 0) || b.doc_no.localeCompare(a.doc_no));

/** 예시 문서 — 화면 구성 확인용 (실제 파일 없음). ponytail: 문서 API 연결 시 삭제 */
export const SAMPLE_DOCS: DocMeta[] = ([
  ['DOC-2026-0001', '취업규칙 (2026 개정)', '근로시간·휴가·복무 규정 전문. 2026년 1월 개정 반영.', 'regulation', 'internal', '경영지원팀', 'E1001', '김민준', '2026-01-05T09:30:00+09:00', '취업규칙_2026.pdf', 1_820_000],
  ['DOC-2026-0002', '정보보안 관리 규정', '문서 보안 등급 분류 기준과 반출·폐기 절차.', 'regulation', 'confidential', '경영지원팀', 'E1001', '김민준', '2026-02-12T09:30:00+09:00', '정보보안관리규정.docx', 412_000],
  ['DOC-2026-0003', '다이캐스팅 작업표준서 (실린더 헤드)', '형폐~취출 9단계 작업 순서와 설비 설정 기준값.', 'sop', 'private', '생산팀', 'E2003', '이서준', '2026-03-20T09:30:00+09:00', 'SOP_다이캐스팅_실린더헤드.pdf', 3_240_000],
  ['DOC-2026-0004', '금형 예열 절차서', '라인 가동 전 금형·슬리브 예열 절차와 확인 항목.', 'sop', 'internal', '생산팀', 'E2003', '이서준', '2026-04-02T09:30:00+09:00', '금형예열절차서.hwp', 286_000],
  ['DOC-2026-0005', '품질 검사 기준서 (외관·기공)', '외관 결함과 기공 판정 한도 견본 포함.', 'quality', 'private', '품질팀', 'E3002', '박지영', '2026-05-14T09:30:00+09:00', '품질검사기준서.pdf', 5_610_000],
  ['DOC-2026-0006', '고객사 불량 대책서 8D (10월)', '고객 클레임 1건 근본 원인 분석과 재발 방지 대책.', 'quality', 'confidential', '품질팀', 'E3002', '박지영', '2026-10-28T09:30:00+09:00', '8D_대책서_2026-10.pptx', 2_090_000],
  ['DOC-2026-0007', '안전보건 관리계획 2026', '연간 안전보건 목표·교육 계획·위험성 평가 일정.', 'safety', 'public', '안전환경팀', 'E4001', '최현우', '2026-01-15T09:30:00+09:00', '안전보건관리계획_2026.pdf', 980_000],
  ['DOC-2026-0008', '용탕 취급 위험성 평가표', '보온로·급탕 작업 위험 요인과 감소 대책.', 'safety', 'internal', '안전환경팀', 'E4001', '최현우', '2026-06-09T09:30:00+09:00', '위험성평가_용탕취급.xlsx', 154_000],
  ['DOC-2026-0009', '설비 예방보전 계획표 (하반기)', '다이캐스팅기·로봇·TCU 점검 주기와 담당자.', 'equipment', 'internal', '설비보전팀', 'E5004', '정다은', '2026-07-01T09:30:00+09:00', '예방보전계획_하반기.xlsx', 221_000],
  ['DOC-2026-0010', '신규 라인 설비 투자 검토서', '라인 3 증설 투자비·회수 기간 검토 (경영회의 안건).', 'report', 'top_secret', '경영지원팀', 'E1001', '김민준', '2026-09-17T09:30:00+09:00', '신규라인_투자검토.pptx', 4_470_000],
  ['DOC-2026-0011', '주간 생산회의 회의록 (11월 2주)', '라인별 생산 실적·불량 현황·조치 사항.', 'report', 'internal', '생산팀', 'E2003', '이서준', '2026-11-13T09:30:00+09:00', '주간생산회의_11월2주.docx', 98_000],
  ['DOC-2026-0012', '작업일보 양식', '교대별 생산 수량·비가동·특이사항 기록 양식.', 'form', 'public', '생산팀', 'E2003', '이서준', '2026-02-03T09:30:00+09:00', '작업일보_양식.xlsx', 46_000],
] as const).map(([doc_no, title, description, category, grade, department, uploader_id, uploader, created_at, file_name, file_size]) =>
  ({ doc_no, title, description, category, grade, department, uploader_id, uploader, created_at, file_name, file_size, sample: true }));
