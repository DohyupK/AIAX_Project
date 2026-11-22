"""로그인 핵심 — 비밀번호 해시·세션 토큰·로그인 실패 잠금·현재 사용자 (표준 라이브러리만, 자체 점검: auth_check.py)

세션 토큰 = base64url(JSON 내용) + "." + base64url(HMAC-SHA256(AUTH_SECRET, 앞부분))
  - 루트 middleware(JH/frontend/common/auth/token.ts)도 같은 방식으로 검증 → 형식 바꿀 때 두 곳 함께
  - httpOnly 쿠키라 화면 JS 에서는 읽을 수 없음
비밀(AUTH_SECRET·ADMIN_ID·ADMIN_PASSWORD)은 루트 .env 만 사용 (AGENTS.md 5항)
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import json
import secrets
import threading
import time
from dataclasses import dataclass

from fastapi import HTTPException, Request

from common.db import _env

COOKIE = "shift_session"
SESSION_SEC = 8 * 3600          # 기본 8시간
REMEMBER_SEC = 14 * 24 * 3600   # 「로그인 유지」 14일
MAX_FAILS, FAIL_WINDOW, LOCK_SEC = 5, 600, 300   # 10분 안에 5번 틀리면 5분 잠금

# scrypt — 표준 라이브러리 비밀번호 해시 (메모리 약 16MB / 회)
_N, _R, _P = 2 ** 14, 8, 1


def hash_password(pw: str) -> str:
    salt = secrets.token_bytes(16)
    dk = hashlib.scrypt(pw.encode(), salt=salt, n=_N, r=_R, p=_P, dklen=32)
    return f"scrypt${_N}${_R}${_P}${salt.hex()}${dk.hex()}"


def verify_password(pw: str, stored: str) -> bool:
    try:
        _, n, r, p, salt, dk = stored.split("$")
        got = hashlib.scrypt(pw.encode(), salt=bytes.fromhex(salt), n=int(n), r=int(r), p=int(p), dklen=len(dk) // 2)
    except (ValueError, TypeError):
        return False
    return hmac.compare_digest(got.hex(), dk)


# ---------- 세션 토큰 ----------
@dataclass(frozen=True)
class Session:
    user_id: str
    name: str
    employee_no: str | None   # 관리자는 None
    admin: bool
    exp: int


def _b64(b: bytes) -> str:
    return base64.urlsafe_b64encode(b).rstrip(b"=").decode()


def _unb64(s: str) -> bytes:
    return base64.urlsafe_b64decode(s + "=" * (-len(s) % 4))


def _secret() -> bytes:
    s = _env("AUTH_SECRET")
    if len(s) < 32:
        raise RuntimeError("루트 .env 의 AUTH_SECRET 은 32자 이상이어야 합니다.")
    return s.encode()


def sign(s: Session) -> str:
    body = _b64(json.dumps({"uid": s.user_id, "name": s.name, "emp": s.employee_no, "adm": s.admin, "exp": s.exp},
                           ensure_ascii=False, separators=(",", ":")).encode())
    return f"{body}.{_b64(hmac.new(_secret(), body.encode(), hashlib.sha256).digest())}"


def parse(token: str | None, now: float | None = None) -> Session | None:
    """서명·만료가 맞으면 Session, 아니면 None (위조·만료·형식 오류 모두 None)"""
    if not token or token.count(".") != 1:
        return None
    body, sig = token.split(".")
    want = _b64(hmac.new(_secret(), body.encode(), hashlib.sha256).digest())
    if not hmac.compare_digest(sig, want):
        return None
    try:
        d = json.loads(_unb64(body))
        s = Session(str(d["uid"]), str(d["name"]), d["emp"], bool(d["adm"]), int(d["exp"]))
    except (ValueError, KeyError, TypeError):
        return None
    return s if s.exp > (now or time.time()) else None


def new_session(user_id: str, name: str, employee_no: str | None, admin: bool, remember: bool) -> tuple[Session, int]:
    ttl = REMEMBER_SEC if remember else SESSION_SEC
    return Session(user_id, name, employee_no, admin, int(time.time()) + ttl), ttl


# ---------- 관리자 (DB에 두지 않음 — .env 로만) ----------
def admin_id() -> str | None:
    try:
        return _env("ADMIN_ID").strip().lower() or None
    except RuntimeError:
        return None


def check_admin(user_id: str, pw: str) -> bool:
    aid = admin_id()
    if not aid or user_id != aid:
        return False
    try:
        want = _env("ADMIN_PASSWORD")
    except RuntimeError:
        return False
    return bool(want) and hmac.compare_digest(pw.encode(), want.encode())


# ---------- 로그인 실패 잠금 (프로세스 메모리 — 서버 재시작 시 초기화) ----------
# ponytail: API 서버가 여러 개로 늘면 DB·Redis 로 옮길 것
_fails: dict[str, tuple[int, float, float]] = {}   # 아이디 → (실패 수, 첫 실패 시각, 잠금 해제 시각)
_lock = threading.Lock()


def locked_for(key: str, now: float | None = None) -> int:
    """남은 잠금 초 (0 = 잠금 아님)"""
    now = now or time.time()
    with _lock:
        _, _, until = _fails.get(key, (0, 0.0, 0.0))
    return max(0, int(until - now))


def record_fail(key: str, now: float | None = None) -> None:
    now = now or time.time()
    with _lock:
        n, first, _ = _fails.get(key, (0, now, 0.0))
        if now - first > FAIL_WINDOW:
            n, first = 0, now
        n += 1
        _fails[key] = (n, first, now + LOCK_SEC if n >= MAX_FAILS else 0.0)
        if len(_fails) > 5000:   # 무한히 커지지 않게 — 오래된 기록 정리
            for k in [k for k, (_, f, u) in _fails.items() if now - f > FAIL_WINDOW and u < now]:
                del _fails[k]


def clear_fails(key: str) -> None:
    with _lock:
        _fails.pop(key, None)


# ---------- 현재 사용자 (다른 API 의존성) ----------
def require_session(request: Request) -> Session:
    s = parse(request.cookies.get(COOKIE))
    if not s:
        raise HTTPException(401, "로그인이 필요합니다.")
    return s


def acting_employee(request: Request) -> tuple[str | None, bool]:
    """(이 요청의 사번, 관리자 여부) — 로그인 세션만 사용 (화면이 보내는 사번 헤더는 무시, 위조 차단)
    관리자는 사번 None = 모든 권한 (인사 전체·Model Management 편집·문서 삭제)
    """
    s = require_session(request)
    return (None, True) if s.admin else (s.employee_no, False)
