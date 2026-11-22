import Image from 'next/image';
import logo from './shift-logo.png';
import s from './Auth.module.css';

/** 로그인·회원가입 공용 틀 — 로고 → 카드(제목·설명·내용) → 카드 아래 링크 → 저작권 */
export default function AuthLayout({ title, sub, wide, below, children }: {
  title: string; sub: string; wide?: boolean; below: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <div className={s.page}>
      <div className={`${s.wrap} ${wide ? s.wide : ''}`}>
        <Image src={logo} alt="Shift — Aluminum Die Casting Platform" priority className={s.logo}
          sizes="(max-width: 460px) 260px, (max-width: 860px) 300px, 340px" />
        <section className={s.card} aria-labelledby="auth-title">
          <h1 id="auth-title" className={s.title}>{title}</h1>
          <p className={s.sub}>{sub}</p>
          {children}
        </section>
        <p className={s.below}>{below}</p>
        <p className={s.copy}>© 2026 Shift · Aluminum Die Casting Platform</p>
      </div>
    </div>
  );
}
