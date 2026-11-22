"""로그인 자체 점검 — 실행: cd JH/api && uv run python -m auth.auth_check
실제 DB·.env 없이: 임시 SQLite, 가짜 org 조회, 테스트용 비밀값. 실패하면 AssertionError.
"""
from __future__ import annotations

import os
import tempfile
from contextlib import contextmanager
from pathlib import Path

os.environ.update(AUTH_SECRET="t" * 40, ADMIN_ID="admin", ADMIN_PASSWORD="Admin-pass-1")

from fastapi.testclient import TestClient  # noqa: E402

from auth import core, router as auth_router, store  # noqa: E402

# ---- 1. 해시·토큰 ----
h = core.hash_password("abcd1234")
assert core.verify_password("abcd1234", h) and not core.verify_password("abcd1235", h)
assert not core.verify_password("x", "깨진값")
s, ttl = core.new_session("kim", "김지환", "e0001", False, False)
tok = core.sign(s)
assert core.parse(tok) == s and ttl == core.SESSION_SEC
body, sig = tok.split(".")
assert core.parse(body + "." + sig[:-2] + "AA") is None              # 서명 위조
forged = core._b64(b'{"uid":"kim","name":"x","emp":"e9999","adm":true,"exp":9999999999}')
assert core.parse(forged + "." + sig) is None                         # 내용 바꿔치기
assert core.parse(tok, now=s.exp + 1) is None                         # 만료
assert core.parse(None) is None and core.parse("a.b.c") is None

# ---- 2. 로그인 실패 잠금 ----
for i in range(core.MAX_FAILS):
    assert core.locked_for("lockme", now=1000 + i) == 0
    core.record_fail("lockme", now=1000 + i)
assert core.locked_for("lockme", now=1010) > 0
assert core.locked_for("lockme", now=1010 + core.LOCK_SEC) == 0
core.clear_fails("lockme")

# ---- 3. API 흐름 (임시 저장소 + 가짜 org) ----
store.DB_PATH = Path(tempfile.mkdtemp()) / "auth.db"
ORG = {"e0001": "김지환", "e0002": "이영희"}


class _Conn:
    def execute(self, _sql, params):
        name = ORG.get(params[0])
        return type("R", (), {"fetchone": lambda _s: {"employee_name": name} if name else None})()


@contextmanager
def _fake_connect(_key):
    yield _Conn()


auth_router.connect = _fake_connect

from fastapi import FastAPI, Request  # noqa: E402

app = FastAPI()
app.include_router(auth_router.router)


@app.get("/who")   # 다른 API 가 쓰는 acting_employee 확인용
def who(request: Request):
    emp, admin = core.acting_employee(request)
    return {"emp": emp, "admin": admin}


c = TestClient(app, base_url="https://testserver")   # Secure 쿠키라 https
ok = {"name": "김지환", "employeeNo": "E0001", "email": "jh@example.com", "userId": "JhKim", "password": "pass1234"}

assert c.get("/api/auth/me").status_code == 401
r = c.post("/api/auth/signup", json={**ok, "name": "홍길동"})           # 이름 불일치
assert r.status_code == 400 and r.json()["detail"]["field"] == "employeeNo", r.json()
r = c.post("/api/auth/signup", json={**ok, "password": "password"})     # 숫자 없음
assert r.status_code == 400 and r.json()["detail"]["field"] == "password"
r = c.post("/api/auth/signup", json={**ok, "userId": "admin"})          # 관리자 아이디 예약
assert r.status_code == 409 and r.json()["detail"]["field"] == "userId"
assert c.post("/api/auth/signup", json=ok).status_code == 201
r = c.post("/api/auth/signup", json={**ok, "userId": "other"})          # 같은 사번 두 번
assert r.status_code == 409 and r.json()["detail"]["field"] == "employeeNo"
r = c.post("/api/auth/signup", json={**ok, "name": "이영희", "employeeNo": "e0002"})   # 같은 아이디
assert r.status_code == 409 and r.json()["detail"]["field"] == "userId"
assert store.find_user("jhkim")["password_hash"].startswith("scrypt$")   # 원문 저장 안 함

r = c.post("/api/auth/login", json={"userId": "jhkim", "password": "wrong999"})
assert r.status_code == 401 and "올바르지" in r.json()["detail"]
r2 = c.post("/api/auth/login", json={"userId": "nobody", "password": "wrong999"})   # 없는 아이디 = 같은 문구
assert r2.status_code == 401 and r2.json()["detail"] == r.json()["detail"] == auth_router.BAD_LOGIN
r = c.post("/api/auth/login", json={"userId": " JHKIM ", "password": "pass1234"})   # 대소문자·공백 무시
assert r.status_code == 200 and r.json() == {"userId": "jhkim", "name": "김지환", "employeeNo": "e0001", "admin": False}
sc = r.headers["set-cookie"].lower()
assert "httponly" in sc and "secure" in sc and "samesite=lax" in sc and "max-age" not in sc   # 로그인 유지 아님
assert c.get("/api/auth/me").json()["employeeNo"] == "e0001"
assert store.find_user("jhkim")["last_login_at"]
# 일반 계정은 헤더로 다른 사번을 보내도 세션 사번
assert c.get("/who", headers={"X-Employee-No": "e0002"}).json() == {"emp": "e0001", "admin": False}

assert c.post("/api/auth/logout").status_code == 200
assert c.get("/api/auth/me").status_code == 401 and c.get("/who").status_code == 401

# 관리자: 모든 권한(None) — 헤더로 다른 사번을 보내도 무시, 로그인 유지 = max-age
r = c.post("/api/auth/login", json={"userId": "admin", "password": "Admin-pass-1", "remember": True})
assert r.status_code == 200 and r.json()["admin"] is True and "max-age" in r.headers["set-cookie"].lower()
assert c.get("/who").json() == {"emp": None, "admin": True}
assert c.get("/who", headers={"X-Employee-No": "e0002"}).json() == {"emp": None, "admin": True}
c.post("/api/auth/logout")

# 5번 틀리면 잠금 → 맞는 비밀번호도 429
for _ in range(core.MAX_FAILS):
    c.post("/api/auth/login", json={"userId": "jhkim", "password": "wrong999"})
assert c.post("/api/auth/login", json={"userId": "jhkim", "password": "pass1234"}).status_code == 429
core.clear_fails("jhkim")

print("auth 자체 점검 통과")
