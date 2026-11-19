'use client';
import { useEffect, useMemo, useState } from 'react';
import {
  ALLOWED_EXT, CATEGORIES, DEPARTMENTS, GRADES, MAX_FILE_BYTES, SAMPLE_DOCS,
  buildDocMeta, canDelete, extOf, formatDateTime, formatSize, nextDocNo, sortDocs, validateUpload,
  type Category, type DocMeta, type Grade, type UploadDraft,
} from './docs';
import { addDoc, deleteDoc, getDocBlob, listDocs, searchDocs, type SearchHit } from './docStore';
import { getCurrentUser } from '../../common/currentUser';
import po from '../process_optimization/ProcessOptimization.module.css';
import s from './CompanyDocuments.module.css';

type Filter = 'all' | Category;
const GRADE = Object.fromEntries(GRADES.map(g => [g.key, g])) as Record<Grade, (typeof GRADES)[number]>;
const CATEGORY_LABEL = Object.fromEntries(CATEGORIES.map(c => [c.key, c.label])) as Record<Category, string>;

/**
 * 사내 문서함 — 카테고리 필터 + 목록/업로드/의미검색
 * 저장: JH API → DOCUMENT_ROOT + org.company_document (청크·임베딩 BG)
 */
export default function CompanyDocuments() {
  const [uploaded, setUploaded] = useState<DocMeta[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [uploadOpen, setUploadOpen] = useState(false);
  const [opened, setOpened] = useState<DocMeta | null>(null);
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<SearchHit[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  useEffect(() => {
    listDocs().then(setUploaded).catch((e: Error) => setLoadError(e.message));
  }, []);

  async function runSearch(e: React.FormEvent) {
    e.preventDefault();
    const query = q.trim();
    if (!query) { setHits(null); setSearchError(null); return; }
    setSearching(true);
    setSearchError(null);
    try {
      setHits(await searchDocs(query));
    } catch (err) {
      setSearchError((err as Error).message);
      setHits([]);
    } finally {
      setSearching(false);
    }
  }

  const docs = useMemo(() => sortDocs([...uploaded, ...SAMPLE_DOCS]), [uploaded]);
  const counts = useMemo(() => {
    const c = { all: docs.length } as Record<Filter, number>;
    for (const cat of CATEGORIES) c[cat.key] = docs.filter(d => d.category === cat.key).length;
    return c;
  }, [docs]);
  const visible = filter === 'all' ? docs : docs.filter(d => d.category === filter);

  return (
    <div className={po.page}>
      <header className={po.head}>
        <div>
          <div className={po.crumb}>사내 문서함</div>
          <h2 className={po.title}>사내 문서함</h2>
        </div>
        <button type="button" className={s.addBtn} onClick={() => setUploadOpen(true)} aria-label="문서 업로드" title="문서 업로드">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden>
            <path d="M12 5v14M5 12h14" />
          </svg>
        </button>
      </header>

      <div className={po.banner}>
        서버 저장: 파일은 DOCUMENT_ROOT, 메타는 org.company_document. 업로드 후 백그라운드에서 청크·OpenAI 임베딩을 만듭니다.
        임베딩·의미검색에는 프로젝트 루트 <code>.env</code>의 <code>OPENAI_API_KEY</code>(sk-…)가 필요합니다. 비어 있으면 업로드만 되고 검색은 실패합니다.
      </div>
      {loadError && <div className={po.errorBox} role="alert">문서를 불러오지 못했습니다: {loadError}</div>}

      <form className={s.searchRow} onSubmit={runSearch}>
        <input className={s.searchInput} value={q} onChange={e => setQ(e.target.value)}
          placeholder="문서 내용 의미 검색 (임베딩)" aria-label="문서 검색" />
        <button type="submit" className={s.primaryBtn} disabled={searching}>{searching ? '검색 중…' : '검색'}</button>
        {hits && <button type="button" className={po.btn} onClick={() => { setHits(null); setQ(''); }}>검색 닫기</button>}
      </form>
      {searchError && <div className={po.errorBox} role="alert">{searchError}</div>}
      {hits && (
        <section className={po.panel} aria-label="검색 결과">
          {hits.length === 0 ? <p className={po.sub}>검색 결과가 없습니다.</p> : (
            <ul className={s.hitList}>
              {hits.map(h => (
                <li key={`${h.company_document_idx}-${h.chunk_no}`}>
                  <b>{h.title}</b> <span className={po.sub}>{h.doc_no} · chunk {h.chunk_no} · score {h.score}</span>
                  <p className={s.hitBody}>{h.content}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <div className={s.categories} role="group" aria-label="카테고리 필터">
        {([{ key: 'all', label: '전체' }, ...CATEGORIES] as { key: Filter; label: string }[]).map(c => (
          <button key={c.key} type="button" aria-pressed={filter === c.key}
            className={`${s.catBtn} ${filter === c.key ? s.catOn : ''}`} onClick={() => setFilter(c.key)}>
            {c.label} <span className={po.num}>{counts[c.key]}</span>
          </button>
        ))}
      </div>

      <section className={po.panel}>
        {visible.length ? (
          <ul className={s.grid}>
            {visible.map(d => (
              <li key={d.doc_no}>
                <button type="button" className={s.card} onClick={() => setOpened(d)}
                  aria-label={`${d.title}, ${GRADE[d.grade].label}, ${d.department} ${d.created_at} — 상세 보기`}>
                  <span className={s.iconBox}><FileIcon name={d.file_name} /></span>
                  <span className={s.cardTitle}>{d.title}</span>
                  <span className={`${s.grade} ${s[`grade_${d.grade}`]}`}>{GRADE[d.grade].label}</span>
                  <span className={`${po.sub} ${s.cardMeta}`}>{d.department} · <span className={po.num}>{formatDateTime(d.created_at).slice(0, 10)}</span></span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className={po.sub}>이 카테고리에 등록된 문서가 없습니다.</p>
        )}
      </section>

      {uploadOpen && (
        <UploadDialog existing={docs.map(d => d.doc_no)} defaultCategory={filter === 'all' ? '' : filter}
          onClose={() => setUploadOpen(false)}
          onUploaded={meta => { setUploaded(u => [...u, meta]); setUploadOpen(false); setFilter(meta.category); }} />
      )}
      {opened && <DetailDialog doc={opened} onClose={() => setOpened(null)}
        onDeleted={docNo => { setUploaded(u => u.filter(d => d.doc_no !== docNo)); setOpened(null); }} />}
    </div>
  );
}

/** 파일 모양 아이콘 — 확장자별 색·글자 */
const EXT_COLOR: Record<string, string> = {
  pdf: '#d93025', docx: '#2b5fb8', xlsx: '#1e7e45', pptx: '#d2611c', hwp: '#2a8fd6', hwpx: '#2a8fd6',
  txt: '#6b7480', png: '#7b4bc4', jpg: '#7b4bc4', jpeg: '#7b4bc4', zip: '#8a6d1f',
};
function FileIcon({ name, size = 72 }: { name: string; size?: number }) {
  const ext = extOf(name);
  const color = EXT_COLOR[ext] ?? '#6b7480';
  return (
    <svg viewBox="0 0 60 72" width={size * 0.83} height={size} aria-hidden>
      <path d="M4 4h36l16 16v48H4z" fill="#ffffff" stroke="#c9d1db" strokeWidth="2" strokeLinejoin="round" />
      <path d="M40 4v16h16" fill="#eef1f5" stroke="#c9d1db" strokeWidth="2" strokeLinejoin="round" />
      {[30, 37, 44].map(y => <line key={y} x1="12" x2="48" y1={y} y2={y} stroke="#dde3ea" strokeWidth="2.5" strokeLinecap="round" />)}
      <rect x="0" y="50" width="46" height="16" rx="3" fill={color} />
      <text x="23" y="62" textAnchor="middle" style={{ fill: '#fff', fontSize: 10, fontWeight: 700, fontFamily: 'ui-monospace, Consolas, monospace' }}>
        {(ext || 'FILE').toUpperCase().slice(0, 4)}
      </text>
    </svg>
  );
}

/** Esc 로 닫기 공용 */
function useEscape(onClose: () => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
}

/** 업로드 팝업 — 파일·제목·설명·카테고리·보안 등급·작성 부서, 문서 번호 자동 */
function UploadDialog({ existing, defaultCategory, onClose, onUploaded }: {
  existing: string[]; defaultCategory: string; onClose: () => void; onUploaded: (meta: DocMeta) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState(defaultCategory);
  const [grade, setGrade] = useState('');
  const [department, setDepartment] = useState('');
  const [tried, setTried] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  useEscape(onClose);
  const user = getCurrentUser(); // 업로더 = 로그인 계정 (직접 입력 없음)

  const year = new Date().getFullYear();
  const docNo = nextDocNo(existing, year);
  const draft: UploadDraft = { title, description, category, grade, department, file: file && { name: file.name, size: file.size } };
  const errors = validateUpload(draft);
  const show = (k: keyof UploadDraft) => (tried ? errors[k] : undefined);

  function pick(f: File | undefined | null) {
    if (!f) return;
    setFile(f);
    // 제목이 비어 있으면 파일 이름(확장자 제외)으로 채움
    if (!title.trim()) setTitle(f.name.replace(/\.[^.]+$/, ''));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setTried(true);
    if (Object.keys(errors).length || !file || !user) return;
    // 등록 일시는 이 순간(등록 버튼 누른 시각)으로 기록
    const meta = buildDocMeta({ ...draft, file: { name: file.name, size: file.size } }, user, docNo);
    setSaving(true);
    setSaveError(null);
    try {
      const saved = await addDoc(meta, file);
      onUploaded(saved);
    } catch (err) {
      setSaveError((err as Error).message); // 실패해도 입력값 유지 (다시 시도 가능)
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={`${po.backdrop}`} onClick={onClose}>
      <form className={`${po.dialog} ${s.dialog}`} role="dialog" aria-modal="true" aria-labelledby="upload-title"
        onClick={e => e.stopPropagation()} onSubmit={submit} noValidate>
        <div className={po.dialogHead}>
          <b id="upload-title">문서 업로드</b>
          <span className={`${po.sub} ${po.num}`}>문서 번호 {docNo} (자동)</span>
          <button type="button" className={po.closeBtn} onClick={onClose} aria-label="닫기">×</button>
        </div>

        <label className={`${s.drop} ${dragOver ? s.dropOver : ''} ${show('file') ? s.invalid : ''}`}
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={e => { e.preventDefault(); setDragOver(false); pick(e.dataTransfer.files[0]); }}>
          <input type="file" className={s.fileInput} accept={ALLOWED_EXT.map(x => `.${x}`).join(',')}
            onChange={e => pick(e.target.files?.[0])} />
          {file ? (
            <span className={s.picked}>
              <FileIcon name={file.name} size={44} />
              <span><b>{file.name}</b><br /><span className={po.sub}>{formatSize(file.size)} · 다른 파일을 고르려면 클릭</span></span>
            </span>
          ) : (
            <span>파일을 끌어다 놓거나 <u>클릭해서 선택</u><br />
              <span className={po.sub}>{ALLOWED_EXT.join(', ')} · 최대 {formatSize(MAX_FILE_BYTES)}</span></span>
          )}
        </label>
        {show('file') && <p className={s.err}>{show('file')}</p>}

        <div className={s.form}>
          <label className={s.field}>
            <span>파일 제목 <em>*</em></span>
            <input value={title} maxLength={120} onChange={e => setTitle(e.target.value)} aria-invalid={!!show('title')} />
            {show('title') && <small className={s.err}>{show('title')}</small>}
          </label>
          <label className={s.field}>
            <span>파일 설명</span>
            <textarea rows={3} value={description} onChange={e => setDescription(e.target.value)} aria-invalid={!!show('description')} />
            <small className={po.sub}>{description.length}/500</small>
            {show('description') && <small className={s.err}>{show('description')}</small>}
          </label>
          <div className={s.row3}>
            <label className={s.field}>
              <span>카테고리 <em>*</em></span>
              <select value={category} onChange={e => setCategory(e.target.value)} aria-invalid={!!show('category')}>
                <option value="">선택</option>
                {CATEGORIES.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
              </select>
              {show('category') && <small className={s.err}>{show('category')}</small>}
            </label>
            <label className={s.field}>
              <span>보안 등급 <em>*</em></span>
              <select value={grade} onChange={e => setGrade(e.target.value)} aria-invalid={!!show('grade')}>
                <option value="">선택</option>
                {GRADES.map(g => <option key={g.key} value={g.key}>{g.label}</option>)}
              </select>
              {grade && GRADE[grade as Grade] && <small className={po.sub}>{GRADE[grade as Grade].ko}</small>}
              {show('grade') && <small className={s.err}>{show('grade')}</small>}
            </label>
            <label className={s.field}>
              <span>작성 부서 <em>*</em></span>
              <select value={department} onChange={e => setDepartment(e.target.value)} aria-invalid={!!show('department')}>
                <option value="">선택</option>
                {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
              {show('department') && <small className={s.err}>{show('department')}</small>}
            </label>
          </div>
          <p className={po.sub} style={{ margin: 0 }}>
            {user ? <>업로더: <b>{user.name}</b> ({user.user_id}) · 로그인 계정으로 자동 기록, 등록 일시는 업로드 시각</> : '로그인 후 업로드할 수 있습니다.'}
          </p>
        </div>

        {saveError && <p className={s.err} role="alert">저장하지 못했습니다: {saveError}</p>}
        <div className={s.actions}>
          <button type="button" className={po.btn} onClick={onClose}>취소</button>
          <button type="submit" className={s.primaryBtn} disabled={saving || !user}>{saving ? '저장 중…' : '업로드'}</button>
        </div>
      </form>
    </div>
  );
}

/** 문서 상세 — 정보 + 다운로드 (예시 문서는 파일 없음) */
function DetailDialog({ doc, onClose, onDeleted }: { doc: DocMeta; onClose: () => void; onDeleted: (docNo: string) => void }) {
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  useEscape(onClose);
  const deletable = canDelete(doc, getCurrentUser());

  async function remove() {
    if (!window.confirm(`「${doc.title}」 문서를 삭제할까요?\n삭제하면 되돌릴 수 없습니다.`)) return;
    setError(null);
    setDeleting(true);
    try {
      const key = doc.company_document_idx ?? doc.doc_no;
      await deleteDoc(key);
      onDeleted(doc.doc_no);
    } catch (e) {
      setError(`삭제하지 못했습니다: ${(e as Error).message}`);
      setDeleting(false);
    }
  }

  async function download() {
    setError(null);
    try {
      const blob = await getDocBlob(doc.doc_no);
      if (!blob) { setError('저장된 파일을 찾을 수 없습니다.'); return; }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.file_name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000); // 다운로드 시작 후 메모리 해제
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const g = GRADE[doc.grade];
  return (
    <div className={po.backdrop} onClick={onClose}>
      <div className={`${po.dialog} ${s.dialog}`} role="dialog" aria-modal="true" aria-labelledby="doc-title" onClick={e => e.stopPropagation()}>
        <div className={po.dialogHead}>
          <span className={`${s.grade} ${s[`grade_${doc.grade}`]}`}>{g.label}</span>
          <span className={`${po.sub} ${po.num}`}>{doc.doc_no}</span>
          <button type="button" className={po.closeBtn} onClick={onClose} aria-label="닫기" autoFocus>×</button>
        </div>
        <div className={s.detailHead}>
          <FileIcon name={doc.file_name} size={64} />
          <div>
            <h3 id="doc-title" className={s.detailTitle}>{doc.title}</h3>
            <span className={po.sub}>{doc.file_name} · {formatSize(doc.file_size)}</span>
          </div>
        </div>
        <dl className={s.meta}>
          <dt>카테고리</dt><dd>{CATEGORY_LABEL[doc.category]}</dd>
          <dt>보안 등급</dt><dd>{g.label} — {g.ko}</dd>
          <dt>작성 부서</dt><dd>{doc.department}</dd>
          <dt>업로더</dt><dd>{doc.uploader ? `${doc.uploader} (${doc.uploader_id})` : '—'}</dd>
          <dt>등록 일시</dt><dd className={po.num}>{formatDateTime(doc.created_at)}</dd>
        </dl>
        <p className={s.desc}>{doc.description || <span className={po.sub}>설명 없음</span>}</p>
        {error && <p className={s.err} role="alert">{error}</p>}
        <div className={s.actions}>
          {deletable && (
            <button type="button" className={s.deleteBtn} onClick={remove} disabled={deleting}>
              {deleting ? '삭제 중…' : '삭제'}
            </button>
          )}
          {doc.sample
            ? <span className={po.sub}>예시 문서 — 실제 파일이 없습니다.</span>
            : <button type="button" className={s.primaryBtn} onClick={download}>다운로드</button>}
        </div>
      </div>
    </div>
  );
}
