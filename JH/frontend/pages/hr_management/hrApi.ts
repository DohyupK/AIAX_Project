// 인사 관리 API 호출 — 서버: JH/api (FastAPI, NCP DB org 원본 실시간)
// 실행: cd JH/api && uv run uvicorn main:app --host 127.0.0.1 --port 8000
// ponytail: 로그인 전 — "현재 사용자"는 목업 계정 사번을 X-Employee-No 헤더로 보냄. 로그인 도입 시 세션 쿠키로 교체

const BASE = process.env.NEXT_PUBLIC_HR_API_BASE_URL ?? 'http://127.0.0.1:8000';

export type Tier = 'basic' | 'manage' | 'hr';

export interface Me {
  employee_no: string; dept_code: number; team_code: number | null; team_name: string | null; is_team_rep: boolean; is_hr: boolean;
  tier: Tier | null; visible_fields: string[]; scope: 'all' | 'team' | 'none'; can_create: boolean;
}
export interface MockAccount {
  employee_no: string; dept_code: number; dept_name: string; position_name: string; team_code: number | null; team_name: string | null; is_team_rep: boolean;
}
export interface DeptSummary {
  dept_code: number; dept_name: string; rep_no: string | null; rep_position: string | null; headcount: number;
  by_position: Record<string, number>; can_view: boolean;
}
export interface TeamSummary {
  team_code: number; team_name: string; rep_no: string | null; rep_position: string | null; rep_dept: number | null; headcount: number;
  by_dept: Record<string, number>; can_view: boolean;
}
export interface Summary {
  positions: { position_name: string; position_code: number }[];
  departments: DeptSummary[];
  teams: TeamSummary[];
}
/** 권한 등급에 따라 칼럼이 빠져서 옴 — 없는 칼럼은 볼 권한 없음 */
export interface Employee {
  employee_no: string; employee_name: string; dept_code: number; dept_name: string;
  position_name: string; position_code: number; team_code: number | null; team_name: string | null; email: string;
  is_dept_rep: boolean; is_team_rep: boolean; can_edit: boolean;
  phone?: string; years_of_service?: number | null; annual_leave_used?: number | null; monthly_overtime_hour?: number | null;
  // age = 서버가 birth_date 로 계산한 만 나이
  age?: number | null; birth_date?: string | null; gender?: string; address?: string; created_at?: string;
}
export interface EmployeeInput {
  dept_code: number; position_name: string; team_code: number | null;
  employee_name: string; birth_date: string; gender: string; phone: string; address: string; email: string;
}

/** 서버 오류 — fields: 항목별 오류 문구 (입력 검증 실패 시) */
export class ApiError extends Error {
  constructor(public status: number, message: string, public fields: Record<string, string> = {}) { super(message); }
}

async function call<T>(who: string, method: string, path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}/api/hr${path}`, {
      method, cache: 'no-store',
      headers: { 'X-Employee-No': who, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, `인사 API 서버(${BASE})에 연결할 수 없습니다. JH/api 서버가 실행 중인지 확인하세요.`);
  }
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const d = data?.detail;
    if (d && typeof d === 'object' && !Array.isArray(d)) throw new ApiError(res.status, Object.values(d).join(' '), d as Record<string, string>);
    if (Array.isArray(d)) throw new ApiError(res.status, '입력값을 확인하세요.', Object.fromEntries(d.map((x: { loc: string[]; msg: string }) => [x.loc.at(-1), x.msg])));
    throw new ApiError(res.status, typeof d === 'string' ? d : `요청 실패 (HTTP ${res.status})`);
  }
  return data as T;
}

export const hrApi = {
  mockAccounts: () => call<MockAccount[]>('', 'GET', '/mock-accounts'),
  me: (who: string) => call<Me>(who, 'GET', '/me'),
  summary: (who: string) => call<Summary>(who, 'GET', '/summary'),
  list: (who: string, by: 'dept' | 'team', key: number) => call<Employee[]>(who, 'GET', `/employees?${by}=${key}`),
  create: (who: string, body: EmployeeInput) => call<Employee>(who, 'POST', '/employees', body),
  update: (who: string, no: string, body: Partial<EmployeeInput>) => call<Employee>(who, 'PATCH', `/employees/${encodeURIComponent(no)}`, body),
  remove: (who: string, no: string) => call<void>(who, 'DELETE', `/employees/${encodeURIComponent(no)}`),
};

/** 화면 표시용 칼럼 이름 (서버가 보낸 칼럼만 표시) */
export const FIELD_LABEL: Record<string, string> = {
  employee_no: '사번', employee_name: '이름', dept_name: '부서', position_name: '직급', team_code: '팀 코드', team_name: '팀', email: '사내 이메일',
  phone: '전화번호', years_of_service: '근속연수', annual_leave_used: '연차 사용', monthly_overtime_hour: '월 초과근무(시간)',
  age: '나이', birth_date: '생년월일', gender: '성별', address: '주소', created_at: '등록 일시',
};
export const TIER_LABEL: Record<Tier, string> = { basic: '기본', manage: '관리', hr: '인사(전체)' };
export const GENDER_LABEL: Record<string, string> = { M: '남', F: '여', other: '기타' };
