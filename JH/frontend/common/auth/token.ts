// 세션 토큰 검증 — 루트 middleware(Edge)에서 사용. JH/api/auth/core.py sign() 과 같은 형식
// 토큰 = base64url(JSON) + "." + base64url(HMAC-SHA256(AUTH_SECRET, 앞부분)) — 형식 바꿀 때 두 곳 함께
// 여기서는 「페이지 이동 허용」만 판단. 실제 권한은 API 서버가 다시 검증

export const SESSION_COOKIE = 'shift_session';
export const AUTH_PAGES = ['/login', '/signup'];

const b64url = (buf: ArrayBuffer) =>
  btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

function decodeJson(part: string): unknown {
  const b64 = part.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (part.length % 4)) % 4);
  return JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))));
}

/** 서명·만료가 맞으면 true. 비밀값이 없거나 형식이 틀리면 false (= 로그인 화면으로) */
export async function isValidSession(token: string | undefined, secret: string | undefined): Promise<boolean> {
  if (!token || !secret || secret.length < 32) return false;
  const parts = token.split('.');
  if (parts.length !== 2) return false;
  try {
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const sig = b64url(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(parts[0])));
    if (sig.length !== parts[1].length) return false;
    let diff = 0; // 길이가 같을 때 끝까지 비교 (비교 시간으로 서명이 드러나지 않게)
    for (let i = 0; i < sig.length; i++) diff |= sig.charCodeAt(i) ^ parts[1].charCodeAt(i);
    if (diff) return false;
    const { exp } = decodeJson(parts[0]) as { exp?: number };
    return typeof exp === 'number' && exp * 1000 > Date.now();
  } catch {
    return false; // 깨진 토큰 — 로그인 화면으로 보내면 되므로 기록하지 않음
  }
}
