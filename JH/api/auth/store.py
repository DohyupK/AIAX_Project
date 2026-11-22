"""로그인 계정 저장소 — DB 테이블 확정 전 임시: JH/data/auth.db (SQLite, git 제외 · AGENTS.md 10항 목업)

칼럼 = 나중 DB 테이블 그대로 옮길 형태 (소문자 snake_case)
  user_id(PK, 소문자) · password_hash(scrypt) · employee_no(UNIQUE → org.employee) · user_name · email · created_at · last_login_at
관리자 계정은 여기 넣지 않음 (.env ADMIN_ID / ADMIN_PASSWORD)
ponytail: DB 테이블이 생기면 이 파일의 함수 3개(find_user·create_user·touch_login)만 Postgres(common.db.connect)로 교체 — 호출하는 쪽은 그대로
"""
from __future__ import annotations

import sqlite3
from contextlib import closing
from datetime import datetime, timezone
from pathlib import Path

DB_PATH = Path(__file__).resolve().parents[2] / "data" / "auth.db"   # JH/api/auth → JH/data

_SCHEMA = """
CREATE TABLE IF NOT EXISTS app_user (
    user_id        TEXT PRIMARY KEY,
    password_hash  TEXT NOT NULL,
    employee_no    TEXT NOT NULL UNIQUE,
    user_name      TEXT NOT NULL,
    email          TEXT NOT NULL,
    created_at     TEXT NOT NULL,
    last_login_at  TEXT
)
"""


def _conn() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    c = sqlite3.connect(DB_PATH, timeout=5)
    c.row_factory = sqlite3.Row
    c.execute(_SCHEMA)
    return c


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


class Duplicate(Exception):
    """아이디 또는 사번이 이미 가입됨 — field = 'userId' | 'employeeNo'"""
    def __init__(self, field: str):
        super().__init__(field)
        self.field = field


def find_user(user_id: str) -> dict | None:
    with closing(_conn()) as c:
        r = c.execute("SELECT * FROM app_user WHERE user_id = ?", (user_id,)).fetchone()
    return dict(r) if r else None


def create_user(user_id: str, password_hash: str, employee_no: str, user_name: str, email: str) -> None:
    with closing(_conn()) as c, c:   # 두 번째 c = 트랜잭션 (성공 커밋 / 실패 롤백)
        try:
            c.execute("INSERT INTO app_user (user_id, password_hash, employee_no, user_name, email, created_at) VALUES (?,?,?,?,?,?)",
                      (user_id, password_hash, employee_no, user_name, email, _now()))
        except sqlite3.IntegrityError as e:
            raise Duplicate("employeeNo" if "employee_no" in str(e) else "userId") from e


def touch_login(user_id: str) -> None:
    with closing(_conn()) as c, c:
        c.execute("UPDATE app_user SET last_login_at = ? WHERE user_id = ?", (_now(), user_id))
