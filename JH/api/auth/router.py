"""로그인·회원가입 API — /api/auth/*

- POST /login   {userId, password, remember} → 세션 쿠키 (관리자 = .env, 일반 = auth 저장소)
- POST /signup  {name, employeeNo, email, userId, password} → 사번이 org 직원이고 이름이 같아야 가입, 사번 1개당 계정 1개
- POST /logout  → 쿠키 삭제
- GET  /me      → 로그인한 사용자 (없으면 401)
권한은 사번이 정함 (인사·Model Management 기존 규칙). 관리자는 모든 권한.
"""
from __future__ import annotations

import logging
import re

from fastapi import APIRouter, HTTPException, Request, Response
from pydantic import BaseModel

from auth import core, store
from common.db import connect

log = logging.getLogger("jh.auth")
router = APIRouter(prefix="/api/auth", tags=["auth"])

ID_RE = re.compile(r"^[a-z0-9][a-z0-9._-]{3,19}$")          # 4~20자 영문 소문자·숫자·._-
PW_RE = re.compile(r"^(?=.*[A-Za-z])(?=.*\d).{8,64}$")        # 8~64자, 영문·숫자 모두
EMAIL_RE = re.compile(r"^[^@\s]{1,64}@[^@\s]+\.[^@\s]{2,}$")
EMP_RE = re.compile(r"^[a-z]\d{4,6}$")                        # org 사번 형식 (e0001)
BAD_LOGIN = "아이디 또는 비밀번호가 올바르지 않습니다."         # 어느 쪽이 틀렸는지 알려 주지 않음
# 없는 아이디도 같은 해시 계산을 거치게 — 응답 시간 차이로 가입 여부가 드러나지 않게
_DUMMY_HASH = core.hash_password("dummy-password-for-timing")


class LoginIn(BaseModel):
    userId: str
    password: str
    remember: bool = False


class SignupIn(BaseModel):
    name: str
    employeeNo: str
    email: str
    userId: str
    password: str


def _field_error(field: str, msg: str, status: int = 400) -> HTTPException:
    """화면이 해당 칸 아래에 문구를 띄우도록 field 를 같이 보냄"""
    return HTTPException(status, {"field": field, "message": msg})


def _set_cookie(res: Response, s: core.Session, ttl: int, remember: bool) -> None:
    # 로그인 유지가 아니면 브라우저 종료 시 삭제(세션 쿠키) — 토큰 자체도 8시간 뒤 만료
    res.set_cookie(core.COOKIE, core.sign(s), max_age=ttl if remember else None, httponly=True,
                   secure=True, samesite="lax", path="/")


def _me(s: core.Session) -> dict:
    return {"userId": s.user_id, "name": s.name, "employeeNo": s.employee_no, "admin": s.admin}


@router.post("/login")
def login(body: LoginIn, res: Response):
    uid = body.userId.strip().lower()
    wait = core.locked_for(uid)
    if wait:
        raise HTTPException(429, f"로그인 실패가 많아 잠시 잠겼습니다. {wait // 60 + 1}분 뒤 다시 시도하세요.")

    if core.check_admin(uid, body.password):
        s, ttl = core.new_session(uid, "관리자", None, True, body.remember)
    else:
        u = store.find_user(uid)
        ok = core.verify_password(body.password, u["password_hash"] if u else _DUMMY_HASH)
        if not u or not ok:
            core.record_fail(uid)
            log.info("로그인 실패 user_id=%s", uid)   # 비밀번호는 남기지 않음
            raise HTTPException(401, BAD_LOGIN)
        s, ttl = core.new_session(uid, u["user_name"], u["employee_no"], False, body.remember)
        store.touch_login(uid)

    core.clear_fails(uid)
    _set_cookie(res, s, ttl, body.remember)
    log.info("로그인 user_id=%s admin=%s", uid, s.admin)
    return _me(s)


@router.post("/signup", status_code=201)
def signup(body: SignupIn):
    name, emp = body.name.strip(), body.employeeNo.strip().lower()
    email, uid = body.email.strip(), body.userId.strip().lower()
    # 형식 검사 — 화면에서도 같은 규칙으로 먼저 검사하지만 서버가 최종
    if not 1 <= len(name) <= 30:
        raise _field_error("name", "이름을 입력하세요.")
    if not EMP_RE.match(emp):
        raise _field_error("employeeNo", "사번 형식이 올바르지 않습니다. (예: e0001)")
    if not EMAIL_RE.match(email):
        raise _field_error("email", "이메일 형식이 올바르지 않습니다.")
    if not ID_RE.match(uid):
        raise _field_error("userId", "아이디는 영문 소문자·숫자로 4~20자입니다. (. _ - 사용 가능)")
    if uid == core.admin_id():
        raise _field_error("userId", "사용할 수 없는 아이디입니다.", 409)
    if not PW_RE.match(body.password):
        raise _field_error("password", "비밀번호는 영문과 숫자를 모두 포함해 8자 이상이어야 합니다.")

    # 사번이 실제 직원이고 이름이 같은지 (남의 사번으로 가입 방지)
    try:
        with connect("HR_DATABASE_URL") as conn:
            row = conn.execute(
                "SELECT i.employee_name FROM org.employee e LEFT JOIN org.employee_info i USING (employee_no) WHERE e.employee_no = %s",
                [emp]).fetchone()
    except Exception:
        log.exception("회원가입 사번 확인 실패 employee_no=%s", emp)
        raise HTTPException(503, "사번을 확인하지 못했습니다. 잠시 뒤 다시 시도하세요.")
    if not row or (row["employee_name"] or "").strip() != name:
        raise _field_error("employeeNo", "사번과 이름이 인사 정보와 일치하지 않습니다.")

    try:
        store.create_user(uid, core.hash_password(body.password), emp, name, email)
    except store.Duplicate as e:
        msg = "이미 사용 중인 아이디입니다." if e.field == "userId" else "이 사번으로 이미 가입된 계정이 있습니다."
        raise _field_error(e.field, msg, 409)
    log.info("회원가입 user_id=%s employee_no=%s", uid, emp)
    return {"ok": True}


@router.post("/logout")
def logout(res: Response):
    res.delete_cookie(core.COOKIE, path="/", secure=True, httponly=True, samesite="lax")
    return {"ok": True}


@router.get("/me")
def me(request: Request):
    return _me(core.require_session(request))
