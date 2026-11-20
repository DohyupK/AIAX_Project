'use client';
import Link from 'next/link';
import { useRef, useState } from 'react';
import { AuthError, signup, type SignupField } from '../../common/auth/authApi';
import AuthLayout from '../../common/auth/AuthLayout';
import PasswordInput from '../../common/auth/PasswordInput';
import s from '../../common/auth/Auth.module.css';
import { validate, type Field, type Values } from './rules';

const EMPTY: Values = { name: '', employeeNo: '', email: '', userId: '', password: '', password2: '' };
const ORDER: Field[] = ['name', 'employeeNo', 'email', 'userId', 'password', 'password2'];

/** 회원가입 화면 (/signup) — 사번이 인사 정보와 맞아야 가입. 완료 → 로그인 화면 */
export default function Signup() {
  const [v, setV] = useState<Values>(EMPTY);
  const [touched, setTouched] = useState<Partial<Record<Field, boolean>>>({});
  const [serverErr, setServerErr] = useState<Partial<Record<Field, string>>>({});
  const [alert, setAlert] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const refs = useRef<Partial<Record<Field, HTMLInputElement | null>>>({});

  const errors = validate(v);
  // 칸을 벗어난 뒤(또는 제출 뒤)부터 문구 표시. 서버 문구는 그 칸을 다시 고치면 지움
  const errOf = (f: Field) => serverErr[f] ?? (touched[f] ? errors[f] : undefined);

  const set = (f: Field) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setV((o) => ({ ...o, [f]: e.target.value }));
    setServerErr((o) => ({ ...o, [f]: undefined }));
  };
  const blur = (f: Field) => () => setTouched((o) => ({ ...o, [f]: true }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setTouched(Object.fromEntries(ORDER.map((f) => [f, true])));
    const first = ORDER.find((f) => errors[f]);
    if (first) { refs.current[first]?.focus(); return; }
    setLoading(true);
    setAlert(null);
    try {
      await signup({ name: v.name.trim(), employeeNo: v.employeeNo.trim(), email: v.email.trim(), userId: v.userId.trim(), password: v.password });
      window.location.replace('/login?joined=1');
    } catch (err) {
      if (err instanceof AuthError && err.field) {
        setServerErr({ [err.field]: err.message });
        refs.current[err.field as SignupField]?.focus();
      } else {
        setAlert(err instanceof AuthError ? err.message : '회원가입하지 못했습니다.');
      }
      setLoading(false);
    }
  }

  // 공용 입력 칸 — 라벨·오류 문구·접근성 속성 연결
  const field = (f: Field, label: string, input: (p: React.InputHTMLAttributes<HTMLInputElement> & { ref: (el: HTMLInputElement | null) => void }) => React.ReactNode, help?: string) => {
    const err = errOf(f);
    const id = `signup-${f}`;
    return (
      <div>
        <label className={s.label} htmlFor={id}>{label}</label>
        {input({
          id, value: v[f], onChange: set(f), onBlur: blur(f), 'aria-invalid': !!err,
          'aria-describedby': err ? `${id}-err` : help ? `${id}-help` : undefined, ref: (el) => { refs.current[f] = el; },
        })}
        {err ? <p id={`${id}-err`} className={s.error}>{err}</p> : help && <p id={`${id}-help`} className={s.help}>{help}</p>}
      </div>
    );
  };

  return (
    <AuthLayout
      wide
      title="회원가입"
      sub="인사 정보에 등록된 이름·사번으로 가입합니다. 권한은 사번에 따라 정해집니다."
      below={<>이미 계정이 있으신가요? <Link className={s.link} href="/login">로그인</Link></>}
    >
      {alert && <p className={s.alert} role="alert">{alert}</p>}
      <form className={s.form} onSubmit={submit} noValidate>
        <div className={s.grid2}>
          {field('name', '이름', (p) => <input {...p} className={s.input} autoComplete="name" />)}
          {field('employeeNo', '사번', (p) => <input {...p} className={s.input} placeholder="예: e0001" autoCapitalize="none" spellCheck={false} />)}
        </div>
        {field('email', '이메일', (p) => <input {...p} type="email" className={s.input} autoComplete="email" placeholder="name@company.com" />)}
        {field('userId', '아이디', (p) => <input {...p} className={s.input} autoComplete="username" autoCapitalize="none" spellCheck={false} />,
          '영문 소문자·숫자 4~20자 (. _ - 사용 가능)')}
        {field('password', '비밀번호', ({ ref, ...p }) => <PasswordInput {...p} ref={ref} autoComplete="new-password" />,
          '영문과 숫자를 모두 포함해 8자 이상')}
        {field('password2', '비밀번호 확인', ({ ref, ...p }) => <PasswordInput {...p} ref={ref} autoComplete="new-password" />)}
        <button type="submit" className={s.btn} disabled={loading}>{loading ? '가입 중…' : '회원가입'}</button>
      </form>
    </AuthLayout>
  );
}
