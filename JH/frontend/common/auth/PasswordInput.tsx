'use client';
import { forwardRef, useState } from 'react';
import s from './Auth.module.css';

type Props = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'className'>;

/** 비밀번호 입력 + 「보기/숨기기」 버튼 (로그인·회원가입 공용) */
const PasswordInput = forwardRef<HTMLInputElement, Props>(function PasswordInput(props, ref) {
  const [show, setShow] = useState(false);
  return (
    <div className={s.pwWrap}>
      <input ref={ref} {...props} type={show ? 'text' : 'password'} className={s.input} />
      <button type="button" className={s.pwToggle} onClick={() => setShow((v) => !v)}
        aria-label={show ? '비밀번호 숨기기' : '비밀번호 보기'} aria-pressed={show}>
        {show ? '숨기기' : '보기'}
      </button>
    </div>
  );
});

export default PasswordInput;
