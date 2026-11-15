// 사내 문서함 저장소 — 목업: 브라우저 IndexedDB (브라우저 기본 기능, 라이브러리 없음)
// ponytail: 이 브라우저에만 저장, 다른 사람과 공유 안 됨. 문서 API·파일 서버 연결 시 아래 4개 함수만 API 호출로 교체
import type { DocMeta } from './docs';

const DB_NAME = 'jh_company_documents';
const STORE = 'documents';
type Row = DocMeta & { blob: Blob };

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => { req.result.createObjectStore(STORE, { keyPath: 'doc_no' }); };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('문서 저장소를 열 수 없습니다.'));
  });
}

/** 트랜잭션 1건 실행 후 DB 연결을 반드시 닫음 (연결 누수 방지) */
async function run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const req = fn(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(req.result);
      tx.onerror = () => reject(tx.error ?? new Error('문서 저장에 실패했습니다.'));
      tx.onabort = () => reject(tx.error ?? new Error('문서 저장이 취소되었습니다. (저장 공간 부족일 수 있음)'));
    });
  } finally {
    db.close();
  }
}

/** 업로드된 문서 정보 목록 (파일 본문 제외) */
export async function listDocs(): Promise<DocMeta[]> {
  const rows = await run<Row[]>('readonly', s => s.getAll() as IDBRequest<Row[]>);
  return rows.map(({ blob: _blob, ...meta }) => meta);
}

/** 문서 등록 — 같은 번호가 이미 있으면 실패 (add) */
export async function addDoc(meta: DocMeta, blob: Blob): Promise<void> {
  await run('readwrite', s => s.add({ ...meta, blob } satisfies Row));
}

/** 문서 삭제 (정보 + 파일 본문) */
export async function deleteDoc(docNo: string): Promise<void> {
  await run('readwrite', s => s.delete(docNo));
}

/** 다운로드용 파일 본문 */
export async function getDocBlob(docNo: string): Promise<Blob | null> {
  const row = await run<Row | undefined>('readonly', s => s.get(docNo) as IDBRequest<Row | undefined>);
  return row?.blob ?? null;
}
