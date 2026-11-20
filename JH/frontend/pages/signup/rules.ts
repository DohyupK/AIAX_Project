// 회원가입 입력 검사 — 서버(JH/api/auth/router.py)와 같은 규칙. 화면은 빠른 안내용, 최종 판단은 서버
// 자체 점검: node JH/frontend/pages/signup/rules.check.ts

export type Field = 'name' | 'employeeNo' | 'email' | 'userId' | 'password' | 'password2';
export type Values = Record<Field, string>;

const EMP_RE = /^[a-z]\d{4,6}$/i;
const EMAIL_RE = /^[^@\s]{1,64}@[^@\s]+\.[^@\s]{2,}$/;
const ID_RE = /^[a-z0-9][a-z0-9._-]{3,19}$/;
const PW_RE = /^(?=.*[A-Za-z])(?=.*\d).{8,64}$/;

/** 칸별 오류 문구 (문제 없는 칸은 빠짐) */
export function validate(v: Values): Partial<Record<Field, string>> {
  const e: Partial<Record<Field, string>> = {};
  const name = v.name.trim();
  if (!name) e.name = '이름을 입력하세요.';
  else if (name.length > 30) e.name = '이름은 30자 이하입니다.';
  if (!v.employeeNo.trim()) e.employeeNo = '사번을 입력하세요.';
  else if (!EMP_RE.test(v.employeeNo.trim())) e.employeeNo = '사번 형식이 올바르지 않습니다. (예: e0001)';
  if (!v.email.trim()) e.email = '이메일을 입력하세요.';
  else if (!EMAIL_RE.test(v.email.trim())) e.email = '이메일 형식이 올바르지 않습니다.';
  if (!v.userId.trim()) e.userId = '아이디를 입력하세요.';
  else if (!ID_RE.test(v.userId.trim().toLowerCase())) e.userId = '아이디는 영문 소문자·숫자로 4~20자입니다. (. _ - 사용 가능)';
  if (!v.password) e.password = '비밀번호를 입력하세요.';
  else if (!PW_RE.test(v.password)) e.password = '비밀번호는 영문과 숫자를 모두 포함해 8자 이상이어야 합니다.';
  if (!v.password2) e.password2 = '비밀번호를 한 번 더 입력하세요.';
  else if (v.password2 !== v.password) e.password2 = '비밀번호가 일치하지 않습니다.';
  return e;
}
