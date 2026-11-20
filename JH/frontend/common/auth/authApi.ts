// 로그인·회원가입 API — JH API /api/auth/* (항상 같은 주소 '/api' — 세션 쿠키가 같은 사이트여야 해서)
// 배포: nginx /api → JH API / 로컬 개발: next.config rewrites(JH_API_ORIGIN) 가 넘겨 줌

export interface Me { userId: string; name: string; employeeNo: string | null; admin: boolean }
export type SignupField = 'name' | 'employeeNo' | 'email' | 'userId' | 'password';
export interface SignupBody { name: string; employeeNo: string; email: string; userId: string; password: string }

/** 서버가 준 오류 — field 가 있으면 그 칸 아래에 표시 */
export class AuthError extends Error {
  constructor(message: string, public status: number, public field?: SignupField) {
    super(message);
  }
}

const TIMEOUT_MS = 15_000;

async function post<T>(path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api/auth/${path}`, {
      method: 'POST',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      cache: 'no-store',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (e) {
    console.error('[auth] 서버 연결 실패', path, e);
    throw new AuthError('서버에 연결하지 못했습니다. 잠시 뒤 다시 시도하세요.', 0);
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const d = data?.detail;
    // 422 = 필수 값 누락 등 형식 오류 (FastAPI 기본 응답)
    if (typeof d === 'object' && d?.message) throw new AuthError(d.message, res.status, d.field);
    throw new AuthError(typeof d === 'string' ? d : '요청을 처리하지 못했습니다.', res.status);
  }
  return data as T;
}

export const login = (userId: string, password: string, remember: boolean) =>
  post<Me>('login', { userId, password, remember });
export const signup = (body: SignupBody) => post<{ ok: true }>('signup', body);
export const logout = () => post<{ ok: true }>('logout');

/** 로그인 안 됐거나 실패면 null */
export async function fetchMe(): Promise<Me | null> {
  try {
    const res = await fetch('/api/auth/me', { cache: 'no-store', signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (res.status === 401) return null;
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as Me;
  } catch (e) {
    console.error('[auth] 내 정보 조회 실패', e);
    return null;
  }
}

/** 로그인 뒤 돌아갈 주소 — 같은 사이트 경로만 허용 (외부 주소로 보내는 공격 차단) */
export function safeNext(next: string | null): string {
  return next && next.startsWith('/') && !next.startsWith('//') && !next.startsWith('/login') && !next.startsWith('/signup')
    ? next
    : '/';
}
