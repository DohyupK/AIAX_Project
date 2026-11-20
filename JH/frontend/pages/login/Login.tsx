'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { AuthError, login, safeNext } from '../../common/auth/authApi';
import AuthLayout from '../../common/auth/AuthLayout';
import PasswordInput from '../../common/auth/PasswordInput';
import s from '../../common/auth/Auth.module.css';

/** 로그인 화면 (/login) — 성공하면 원래 가려던 주소(?next=)로, 없으면 메인 */
export default function Login() {
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [joined, setJoined] = useState(false);
  const [loading, setLoading] = useState(false);
  const idRef = useRef<HTMLInputElement>(null);
  const pwRef = useRef<HTMLInputElement>(null);

  // 회원가입 직후(?joined=1) 안내 — 주소창 값은 브라우저에서만 읽음
  useEffect(() => {
    setJoined(new URLSearchParams(window.location.search).get('joined') === '1');
    idRef.current?.focus();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!userId.trim()) { setError('아이디를 입력하세요.'); idRef.current?.focus(); return; }
    if (!password) { setError('비밀번호를 입력하세요.'); pwRef.current?.focus(); return; }
    setLoading(true);
    setError(null);
    try {
      await login(userId.trim(), password, remember);
      // 전체 새로 고침 이동 — 새 세션 쿠키로 사이드바·헤더·권한이 처음부터 그려지게
      window.location.replace(safeNext(new URLSearchParams(window.location.search).get('next')));
    } catch (err) {
      setError(err instanceof AuthError ? err.message : '로그인하지 못했습니다.');
      setPassword('');
      pwRef.current?.focus();
      setLoading(false);
    }
  }

  return (
    <AuthLayout
      title="로그인"
      sub="Shift 계정으로 로그인하세요."
      below={<>계정이 없으신가요? <Link className={s.link} href="/signup">회원가입</Link></>}
    >
      {joined && !error && <p className={s.success} role="status">회원가입이 완료되었습니다. 로그인하세요.</p>}
      {error && <p className={s.alert} role="alert">{error}</p>}
      <form className={s.form} onSubmit={submit} noValidate>
        <div>
          <label className={s.label} htmlFor="login-id">아이디</label>
          <input id="login-id" ref={idRef} className={s.input} value={userId} autoComplete="username"
            autoCapitalize="none" spellCheck={false} onChange={(e) => setUserId(e.target.value)} />
        </div>
        <div>
          <label className={s.label} htmlFor="login-pw">비밀번호</label>
          <PasswordInput id="login-pw" ref={pwRef} value={password} autoComplete="current-password"
            onChange={(e) => setPassword(e.target.value)} />
        </div>
        <div className={s.row}>
          <label className={s.check}>
            <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
            로그인 유지 (14일)
          </label>
        </div>
        <button type="submit" className={s.btn} disabled={loading}>{loading ? '로그인 중…' : '로그인'}</button>
      </form>
    </AuthLayout>
  );
}
